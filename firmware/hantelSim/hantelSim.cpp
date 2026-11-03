/*
 * IoT-Hantel – Simulator ohne Sensor
 * - Simuliert Trainingssaetze, damit die WebApp mit einem echten Photon 2
 *   getestet werden kann, bevor der LIS3DH angeschlossen ist.
 * - Gleicher Cloud-Vertrag wie IoTHantel.cpp:
 *   Event "training", Variablen "repetitions", "totalCount", "sensorOk",
 *   Funktion "resetTotal".
 */

#include "Particle.h"

SYSTEM_MODE(AUTOMATIC);
SerialLogHandler logHandler(LOG_LEVEL_INFO); // System-Logs im Serial Monitor anzeigen

// --- Simulierter Trainingsrhythmus --------------------------------------
const unsigned long REST_MIN_MS = 20000; // Pause zwischen zwei Saetzen
const unsigned long REST_MAX_MS = 40000;
const unsigned long REP_MIN_MS = 1500;   // Zeit zwischen zwei Wiederholungen
const unsigned long REP_MAX_MS = 2500;
const int REPS_MIN = 8;                  // Wiederholungen pro Satz
const int REPS_MAX = 15;
const int START_MIN_REPS = 3;            // wie IoTHantel.cpp: Start ab 3. Wiederholung
const unsigned long END_PAUSE_MS = 5000; // wie IoTHantel.cpp: Ende nach 5 s Pause

// --- Cloud-Vertrag (identisch mit IoTHantel.cpp) -------------------------
const char *EVENT_NAME = "training";
const uint32_t EEPROM_MAGIC = 0x48414E54; // "HANT": markiert gueltige Daten im EEPROM
const int EEPROM_ADDRESS = 0;

struct StoredTotal
{
    uint32_t magic;
    int32_t total;
};

int repetitions = 0; // Cloud-Variable: Wiederholungen im laufenden Satz
int totalCount = 0;  // Cloud-Variable: Wiederholungen ueber alle Saetze
int sensorOk = 1;    // Cloud-Variable: der Simulator hat immer einen "Sensor"

bool inSet = false;           // laeuft gerade ein simulierter Satz?
bool training = false;        // true = Satz wurde erkannt (ab START_MIN_REPS)
int repCount = 0;             // Wiederholungen im aktuellen Satz
int targetReps = 0;           // so viele Wiederholungen macht der aktuelle Satz
unsigned long firstRepMs = 0; // Zeitpunkt erste Wiederholung (Satzdauer)
unsigned long lastRepMs = 0;  // Zeitpunkt letzte Wiederholung (Pause)
unsigned long nextMs = 0;     // naechste Wiederholung bzw. naechster Satzbeginn

// Gesamtzaehler aus dem EEPROM laden (ueberlebt Neustart und Stromausfall)
void loadTotal()
{
    StoredTotal stored;
    EEPROM.get(EEPROM_ADDRESS, stored);
    totalCount = (stored.magic == EEPROM_MAGIC && stored.total >= 0) ? stored.total : 0;
}

// Nur bei Satzende und Reset schreiben, um den Flash zu schonen
void saveTotal()
{
    StoredTotal stored = {EEPROM_MAGIC, totalCount};
    EEPROM.put(EEPROM_ADDRESS, stored);
}

// Cloud-Funktion: setzt den Gesamtzaehler zurueck. Nur Argument "0" ist erlaubt.
int resetTotal(String arg)
{
    if (arg != "0")
    {
        return -1;
    }
    totalCount = 0;
    saveTotal();
    Serial.println("# Gesamtzaehler zurueckgesetzt");
    return 0;
}

void onRepetition(unsigned long now)
{
    if (repCount == 0)
    {
        firstRepMs = now;
    }
    repCount++;
    lastRepMs = now;
    Serial.printlnf("# Wiederholung %d", repCount);

    if (!training && repCount >= START_MIN_REPS)
    {
        training = true;
        totalCount += repCount; // Wiederholungen vor dem Start zaehlen mit
        repetitions = repCount;
        Serial.println("# TRAINING START");
        Particle.publish(EVENT_NAME, String::format("{\"type\":\"start\",\"total\":%d}", totalCount));
    }
    else if (training)
    {
        totalCount++;
        repetitions = repCount;
    }
}

void endSet()
{
    unsigned long durationS = (lastRepMs - firstRepMs) / 1000;
    Serial.printlnf("# TRAINING ENDE: %d Wiederholungen, %lu s", repCount, durationS);
    saveTotal();
    Particle.publish(EVENT_NAME, String::format("{\"type\":\"end\",\"reps\":%d,\"duration\":%lu,\"total\":%d}",
                                                repCount, durationS, totalCount));
    inSet = false;
    training = false;
    repCount = 0;
    repetitions = 0;
}

void setup()
{
    loadTotal();
    Particle.variable("repetitions", repetitions);
    Particle.variable("totalCount", totalCount);
    Particle.variable("sensorOk", sensorOk);
    Particle.function("resetTotal", resetTotal);
    Serial.begin(9600);
    nextMs = millis() + 5000; // erster Satz kurz nach dem Start
}

void loop()
{
    unsigned long now = millis();
    if (!inSet)
    {
        if ((long)(now - nextMs) >= 0)
        {
            inSet = true;
            targetReps = random(REPS_MIN, REPS_MAX + 1);
            nextMs = now;
        }
        return;
    }
    if (repCount < targetReps)
    {
        if ((long)(now - nextMs) >= 0)
        {
            onRepetition(now);
            nextMs = now + random(REP_MIN_MS, REP_MAX_MS + 1);
        }
    }
    else if (now - lastRepMs > END_PAUSE_MS)
    {
        endSet();
        nextMs = now + random(REST_MIN_MS, REST_MAX_MS + 1);
    }
}

/*
 * IoT-Hantel
 * - Liest Beschleunigung (LIS3DH) mit 20 Hz
 * - Cloud-Vertrag (identisch mit firmware/hantelSim/hantelSim.cpp):
 *   Event "training" als JSON, Variablen "repetitions", "totalCount", "sensorOk",
 *   Funktion "resetTotal"
 */

#include "Particle.h"
#include "Adafruit_Sensor.h"
#include "LIS3DH_zhaw.h"

SYSTEM_MODE(AUTOMATIC);
SerialLogHandler logHandler(LOG_LEVEL_INFO); // System-Logs im Serial Monitor anzeigen

LIS3DH_zhaw lis = LIS3DH_zhaw(); // Beschleunigungssensor (I2C)
int counter = 0;                 // laufende Messwert-Nummer (1. CSV-Spalte)
int configOk = 0;                // Cloud-Variable "sensorOk": 1 = Sensor erfolgreich initialisiert
float x_accel, y_accel, z_accel; // aktuelle Beschleunigung in m/s^2

// --- Trainingserkennung -------------------------------------------------
// Eine Wiederholung = Y-Achse schwingt von unter Y_LOW nach ueber Y_HIGH
// (Hysterese, damit Rauschen und einzelne Ausreisser keine Wiederholung ausloesen).
// Training beginnt erst, wenn mehrere Wiederholungen in regelmaessigem Takt
// ueber eine Mindestdauer erkannt wurden; es endet nach einer Pause ohne Wiederholung.
const unsigned long SAMPLE_INTERVAL_MS = 50; // 20 Hz Abtastrate
const float EMA_ALPHA = 0.3F;                // Glaettung (0..1, kleiner = staerker)
const float Y_HIGH = 2.0F;                   // m/s^2, Hantel oben (Y steigt auf ca. 4)
const float Y_LOW = 0.5F;                    // m/s^2, Hantel unten / Ruhe (Y ca. 0.2)
const unsigned long REP_MIN_MS = 600;        // kuerzeste plausible Wiederholung
const unsigned long REP_MAX_MS = 4000;       // laengste plausible Wiederholung
const int START_MIN_REPS = 3;                // Wiederholungen bis Trainingsbeginn
const unsigned long START_MIN_MS = 3000;     // Mindestdauer bis Trainingsbeginn
const unsigned long END_PAUSE_MS = 5000;     // Pause, nach der das Training endet

// Zustand der Hantel bezogen auf die Schwellwerte
enum Phase
{
    PHASE_NEUTRAL,
    PHASE_LOW,
    PHASE_HIGH
};
Phase phase = PHASE_NEUTRAL;    // aktuelle Phase (unten / oben)
bool wasLow = false;            // seit letzter Wiederholung unten gewesen?
bool training = false;          // true = Training laeuft
float ySmooth = 0.0F;           // geglaetteter Y-Wert
int repCount = 0;               // Wiederholungen im aktuellen (Kandidaten-)Training
int repetitions = 0;            // Cloud-Variable: Hantelbewegungen im laufenden Training
int totalCount = 0;             // Cloud-Variable: Hantelbewegungen ueber alle Trainings
unsigned long firstRepMs = 0;   // Zeitpunkt erste Wiederholung (Trainingsdauer)
unsigned long lastRepMs = 0;    // Zeitpunkt letzte Wiederholung (Takt, Pause)
unsigned long lastSampleMs = 0; // Zeitpunkt letzte Messung (Abtastrate)

// --- Cloud und Speicher -------------------------------------------------
const char *EVENT_NAME = "training";
const uint32_t EEPROM_MAGIC = 0x48414E54; // "HANT": markiert gueltige Daten im EEPROM
const int EEPROM_ADDRESS = 0;

struct StoredTotal
{
    uint32_t magic;
    int32_t total;
};

// Gesamtzaehler aus dem EEPROM laden (ueberlebt Neustart und Stromausfall)
void loadTotal()
{
    StoredTotal stored;
    EEPROM.get(EEPROM_ADDRESS, stored);
    totalCount = (stored.magic == EEPROM_MAGIC && stored.total >= 0) ? stored.total : 0;
}

// Nur bei Trainingsende und Reset schreiben, um den Flash zu schonen
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

// Wird bei jeder erkannten Hantelbewegung aufgerufen
void onRepetition(unsigned long now)
{
    unsigned long interval = now - lastRepMs; // Zeit seit letzter Wiederholung
    if (repCount > 0 && (interval < REP_MIN_MS || interval > REP_MAX_MS))
    {
        // Takt passt nicht -> nur beim Kandidaten neu beginnen, laufendes Training nicht abbrechen
        if (!training)
        {
            repCount = 0;
        }
        else if (interval < REP_MIN_MS)
        {
            return; // zu schnell: Ausreisser ignorieren (kein Doppelzaehlen)
        }
    }
    if (repCount == 0)
    {
        firstRepMs = now; // erste Wiederholung merken
    }
    repCount++;
    lastRepMs = now;
    Serial.printlnf("# Wiederholung %d", repCount);

    // Trainingsbeginn: genug Wiederholungen ueber Mindestdauer
    if (!training && repCount >= START_MIN_REPS && now - firstRepMs >= START_MIN_MS)
    {
        training = true;
        totalCount += repCount; // Wiederholungen vor dem Start zaehlen mit
        repetitions = repCount;
        Serial.println("# TRAINING START");
        Particle.publish(EVENT_NAME, String::format("{\"type\":\"start\",\"total\":%d}", totalCount));
    }
    else if (training)
    {
        repetitions = repCount;
        totalCount++;
    }
}

// Pro Messwert aufrufen: glaetten, Bewegung erkennen, Trainingsende pruefen
void detectTraining(float y, unsigned long now)
{
    // Exponentieller gleitender Mittelwert gegen Rauschen und Ausreisser
    ySmooth = EMA_ALPHA * y + (1.0F - EMA_ALPHA) * ySmooth;

    // Hysterese: Phase wechselt nur beim Ueberschreiten der Schwellwerte
    if (ySmooth < Y_LOW && phase != PHASE_LOW)
    {
        phase = PHASE_LOW; // Hantel unten
        wasLow = true;
    }
    else if (ySmooth > Y_HIGH && phase != PHASE_HIGH)
    {
        phase = PHASE_HIGH; // Hantel oben
        if (wasLow)
        { // voller Zyklus tief -> hoch = eine Wiederholung
            wasLow = false;
            onRepetition(now);
        }
    }

    // Trainingsende: zu lange keine Wiederholung mehr
    if (repCount > 0 && now - lastRepMs > END_PAUSE_MS)
    {
        if (training)
        {
            unsigned long durationS = (lastRepMs - firstRepMs) / 1000;
            Serial.printlnf("# TRAINING ENDE: %d Wiederholungen, %lu s", repCount, durationS);
            saveTotal();
            Particle.publish(EVENT_NAME, String::format("{\"type\":\"end\",\"reps\":%d,\"duration\":%lu,\"total\":%d}",
                                                        repCount, durationS, totalCount));
        }
        // Zuruecksetzen (auch bei abgebrochenem Kandidaten ohne Trainingsstart)
        training = false;
        repCount = 0;
        repetitions = 0;
    }
}

// Diagnose: alle I2C-Adressen abfragen und gefundene Geraete ausgeben
void scanI2C()
{
    int found = 0;
    for (uint8_t addr = 1; addr < 127; addr++)
    {
        Wire.beginTransmission(addr);
        if (Wire.endTransmission() == 0)
        { // 0 = Geraet hat geantwortet
            Serial.printlnf("  I2C-Geraet gefunden bei 0x%02X", addr);
            found++;
        }
    }
    if (found == 0)
    {
        Serial.println("  Kein I2C-Geraet gefunden");
    }
    else
    {
        // WHO_AM_I-Register (0x0F) lesen, LIS3DH muss 0x33 liefern
        for (uint8_t addr : {0x18, 0x19})
        {
            Wire.beginTransmission(addr);
            Wire.write(0x0F);
            if (Wire.endTransmission() == 0 && Wire.requestFrom(addr, (uint8_t)1) == 1)
            {
                Serial.printlnf("  WHO_AM_I bei 0x%02X = 0x%02X (erwartet 0x33)", addr, Wire.read());
            }
        }
    }
}

// Sensor initialisieren, 0x18 (SDO an GND) und 0x19 (SDO an 3V3) probieren
bool initSensor()
{
    if (lis.begin(0x18) || lis.begin(0x19))
    {
        lis.setRange(LIS3DH_RANGE_2_G); // Messbereich +-2 g (2, 4, 8 oder 16 moeglich)
        Serial.println("LIS3DH configured successfully"); // Status in der Cloud: Variable "sensorOk"
        return true;
    }
    Serial.println("LIS3DH configuration failed - Verkabelung pruefen (SDA=D0, SCL=D1, 3V3, GND)");
    scanI2C();
    return false;
}

void setup()
{
    loadTotal();                                   // Gesamtzaehler vom letzten Betrieb uebernehmen
    Particle.variable("repetitions", repetitions); // Zaehler in der Cloud lesbar machen
    Particle.variable("totalCount", totalCount);   // Gesamtzaehler ueber alle Trainings
    Particle.variable("sensorOk", configOk);       // 1 = Sensor gefunden, 0 = Verkabelung pruefen
    Particle.function("resetTotal", resetTotal);   // Gesamtzaehler zuruecksetzen (nur "0")
    Serial.begin(9600);
    waitFor(Serial.isConnected, 10000); // bis zu 10 s auf den Serial Monitor warten

    Serial.printlnf("Welcome to the Hantelapp! Counter;X-Accel;Y-Accel;Z-Accel"); // CSV-Kopfzeile
    configOk = initSensor();
}

void loop()
{
    if (configOk == 0)
    {
        // erneut versuchen, damit die Fehlermeldung auch spaeter noch sichtbar ist
        configOk = initSensor();
        delay(2000);
        return;
    }

    // Feste Abtastrate ohne delay(): nur alle SAMPLE_INTERVAL_MS messen
    unsigned long now = millis();
    if (now - lastSampleMs < SAMPLE_INTERVAL_MS)
    {
        return;
    }
    lastSampleMs = now;

    // Sensor auslesen, Umrechnung g -> m/s^2
    lis.read();
    x_accel = lis.x_g * 9.80665F;
    y_accel = lis.y_g * 9.80665F;
    z_accel = lis.z_g * 9.80665F;
    Serial.printlnf("%d;%f;%f;%f", counter, x_accel, y_accel, z_accel); // CSV-Zeile fuer Excel
    counter++;

    detectTraining(y_accel, now); // Auswertung nur ueber Y-Achse
}

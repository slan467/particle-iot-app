// Include Particle Device OS APIs
#include "Particle.h"
#include <climits>

// Let Device OS manage the connection to the Particle Cloud
SYSTEM_MODE(AUTOMATIC);

// Show system, cloud connectivity, and application logs over USB
// View logs with CLI using 'particle serial monitor --follow'
SerialLogHandler logHandler(LOG_LEVEL_INFO);

int counter = 0;

int setCounter(String counterValue) {
    // convert to Integer
    counter = counterValue.toInt();
    return counter;
}

void setup() {
    Particle.function("setCounter", setCounter);
    Particle.variable("counter", counter);
}

void loop() {
    if (counter%100 == 0) {
        // in jedem 100. Durchlauf aufrufen
        Particle.publish("CounterEvent", String(counter));
    }
    // Stop at the integer limit rather than overflowing or wrapping to zero.
    if (counter < INT_MAX) counter++;
    delay(100);
}

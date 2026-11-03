# Connect a Photon 2 and MongoDB

## 1. Prepare your device

Claim your Photon 2 in your own Particle account and connect it to Wi-Fi. Copy its device ID from the Particle Console. Each team should use its own account and resources rather than sharing another person's credentials.

Work in two steps. Both firmwares have exactly the same cloud contract, so the web application does not change between them.

**Step 1 – simulator, no sensor.** Use `firmware/hantelSim/hantelSim.cpp` as the application source in your Particle Workbench project. Select **Photon 2** and a current supported stable Device OS for the board (tested to compile with 6.4.1). Compile, then flash your own device. Flashing replaces its current application; save any existing firmware you need first. The simulator needs no libraries. About five seconds after startup it trains a set of 8–15 repetitions every 20–40 seconds.

**Step 2 – real dumbbell.** Wire the LIS3DH (SDA=D0, SCL=D1, 3V3, GND), add the libraries `Adafruit_Sensor` and `LIS3DH_zhaw` to the Workbench project, and flash `firmware/hantelApp/IoTHantel.cpp`. It measures at 20 Hz and counts a repetition when the smoothed Y axis moves from below 0.5 m/s² to above 2 m/s². The serial monitor still prints CSV lines for Excel.

Both firmwares:

- publish `training` with JSON data: `{"type":"start","total":123}` at the third regular repetition and `{"type":"end","reps":12,"duration":22,"total":132}` five seconds after the last repetition;
- expose the variables `repetitions` (current set, 0 while resting), `totalCount` and `sensorOk` (1 = sensor found; the simulator always reports 1);
- register `resetTotal`, which accepts only `"0"` and returns `0`, or `-1` for any other argument;
- keep `totalCount` in the emulated EEPROM. It is written only at the end of a set and on reset, to limit flash wear, so repetitions of a set interrupted by a power loss are not saved.

Check the events in Particle Console before configuring the web application. Their data should be JSON as shown above. Particle adds `coreid` and `published_at` to the streamed envelope. Calling `resetTotal` with `0` in the Console should return `0`.

## 2. Create two-legged credentials

In Particle Console, open **Authentication** for the account Sandbox owning the device. Create a client using **Two-Legged Auth (Server)**. Copy the client ID and secret into your local `.env`. The secret is only shown once.

The server exchanges those credentials using `grant_type=client_credentials`, matching the SDK’s `loginAsClientOwner` approach. No account username/password or browser login is needed. A token is requested with a one-hour lifetime, cached in memory and renewed as needed.

For a device managed inside a Particle product, create an appropriately authorized client in that product’s context and set `PARTICLE_PRODUCT_ID`. Authentication permissions and endpoint selection are separate: the product setting changes the REST/event URLs but cannot grant permissions by itself. The simplest setup is a personally owned Sandbox device with no product ID.

## 3. Create a separate Atlas database

1. Create your own MongoDB Atlas project and choose a **Free** cluster in a suitable region.
2. Create a database user with `readWrite` access to your application database, for example `iot_starter`. This user is different from your Atlas website login.
3. Add your current public IP under Atlas Network Access for local development.
4. Use Atlas’s **Connect → Drivers → Node.js** instructions to obtain a `mongodb+srv://` URI. Replace its placeholders locally; URL-encode special characters in the password.
5. Set `MONGODB_URI` and `MONGODB_DATABASE`. The application creates `training_events` and its indexes when first used. A `readings` collection from the counter template is left untouched. The database user needs permission to create indexes.

For Render, add the service’s documented outbound IP ranges to the Atlas IP access list. These are the service’s egress ranges, not your dashboard’s hostname. See [deployment](deployment.md). Keep the URI private even though the website is public.

## 4. Start live mode

Set these in `.env` without including angle brackets:

```dotenv
APP_MODE=live
PARTICLE_CLIENT_ID=your-client-id
PARTICLE_CLIENT_SECRET=your-client-secret
PARTICLE_DEVICE_ID=your-24-character-device-id
MONGODB_URI=mongodb+srv://your-user:your-encoded-password@your-cluster.mongodb.net/
MONGODB_DATABASE=iot_starter
```

Restart with `npm run dev`. The collector should connect, and after a set the dashboard should show a new bar and table row. Test **Read device now** and **Reset total count**. Close the browser while leaving the local server running; reopen it later to confirm collection continued.

For watering or home-assistance projects, implement actuator timeouts, valid input ranges and a safe disconnected state in firmware. Server validation is a second layer and cannot protect hardware while the network is unavailable.

References: [Particle Cloud API](https://docs.particle.io/reference/cloud-apis/api/), [Particle JavaScript SDK](https://docs.particle.io/reference/SDKs/javascript/), [Atlas Free limits](https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/).

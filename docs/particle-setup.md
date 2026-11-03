# Connect a Photon 2 and MongoDB

## 1. Prepare your device

Claim your Photon 2 in your own Particle account and connect it to Wi-Fi. Copy its device ID from the Particle Console. Each team should use its own account and resources rather than sharing another person's credentials.

Use `firmware/counter/counter.cpp` as the application source in your Particle Workbench project. Select **Photon 2** and a current supported stable Device OS for the board. Compile, then flash your own device. Flashing replaces its current application; save any existing firmware you need first.

The example increments a counter every 100 ms, exposes `counter`, registers `setCounter`, and publishes `CounterEvent` whenever the counter is a multiple of 100 (approximately every ten seconds). It stops incrementing at the signed 32-bit integer maximum, 2,147,483,647, rather than wrapping. The firmware function converts its argument to an integer and returns the new value; the dashboard only sends `"0"`. Resetting to zero causes a publication on the next loop. Device functions run in the application context.

Check the event in Particle Console before configuring the web application. Its data should look like a decimal string, such as `"42"`. Particle adds `coreid` and `published_at` to the streamed envelope.

## 2. Create two-legged credentials

In Particle Console, open **Authentication** for the account Sandbox owning the device. Create a client using **Two-Legged Auth (Server)**. Copy the client ID and secret into your local `.env`. The secret is only shown once.

The server exchanges those credentials using `grant_type=client_credentials`, matching the SDK’s `loginAsClientOwner` approach. No account username/password or browser login is needed. A token is requested with a one-hour lifetime, cached in memory and renewed as needed.

For a device managed inside a Particle product, create an appropriately authorized client in that product’s context and set `PARTICLE_PRODUCT_ID`. Authentication permissions and endpoint selection are separate: the product setting changes the REST/event URLs but cannot grant permissions by itself. The simplest setup is a personally owned Sandbox device with no product ID.

## 3. Create a separate Atlas database

1. Create your own MongoDB Atlas project and choose a **Free** cluster in a suitable region.
2. Create a database user with `readWrite` access to your application database, for example `iot_starter`. This user is different from your Atlas website login.
3. Add your current public IP under Atlas Network Access for local development.
4. Use Atlas’s **Connect → Drivers → Node.js** instructions to obtain a `mongodb+srv://` URI. Replace its placeholders locally; URL-encode special characters in the password.
5. Set `MONGODB_URI` and `MONGODB_DATABASE`. The application creates `readings` and its indexes when first used. The database user needs permission to create indexes.

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

Restart with `npm run dev`. The collector should connect, events should appear, and the stored count should increase. Test variable read and reset. Close the browser while leaving the local server running; reopen it later to confirm collection continued.

For watering or home-assistance projects, implement actuator timeouts, valid input ranges and a safe disconnected state in firmware. Server validation is a second layer and cannot protect hardware while the network is unavailable.

References: [Particle Cloud API](https://docs.particle.io/reference/cloud-apis/api/), [Particle JavaScript SDK](https://docs.particle.io/reference/SDKs/javascript/), [Atlas Free limits](https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/).

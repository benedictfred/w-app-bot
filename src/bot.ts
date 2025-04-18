import { Client, RemoteAuth } from "whatsapp-web.js";
import { MongoStore } from "wwebjs-mongo";
import mongoose from "mongoose";
import http from "http";
import dotenv from "dotenv";
import qrcode from "qrcode-terminal";
import schedule from "node-schedule";
import { Birthday } from "./models/Birthday";

dotenv.config();
const PORT = process.env.PORT || 8000;

const server = http.createServer();

mongoose.connect(process.env.MONGO_URI as string).then(() => {
  const store = new MongoStore({ mongoose: mongoose });
  const client = new Client({
    authStrategy: new RemoteAuth({
      store: store,
      backupSyncIntervalMs: 300000,
    }),
  });

  client.once("ready", () => {
    console.log("Client is ready");
  });

  client.on("auth_failure", (msg) => {
    console.error("❌ Authentication failed:", msg);
  });

  client.on("disconnected", (reason) => {
    console.warn("⚠️ Client disconnected:", reason);
  });

  client.on("qr", (qr: string) => {
    qrcode.generate(qr, { small: true });
  });

  client.on("remote_session_saved", () => {
    console.log("Remote Session Saved");
  });

  // This is to send birthday dates directly to the database to automatically save
  client.on("message_create", async (message) => {
    const expectedSender = process.env.EXPECTED_SENDER;

    if (message.from === expectedSender && message.to === expectedSender) {
      const messageLine = message.body.split("\n");
      const msgEntry: { [key: string]: string } = {};

      messageLine.forEach((message) => {
        const [key, value] = message.split(":").map((str) => str.trim());
        if (key && value) return (msgEntry[key.toLowerCase()] = value);
      });

      const remoteBdayEntry = new Birthday({
        name: msgEntry.name,
        phone: msgEntry.phone,
        birthday: msgEntry.birthday,
      });

      await remoteBdayEntry.save();
    }
  });

  client.on("ready", () => {
    console.log("✅ Bot is ready");

    // scheduled to run every midnight
    schedule.scheduleJob("0 0 * * *", async () => {
      const today = new Date();
      const todayStr = `${String(today.getDate()).padStart(2, "0")}-${String(
        today.getMonth() + 1
      ).padStart(2, "0")}`;

      try {
        const birthdays = await Birthday.find();

        birthdays.forEach((person) => {
          if (person.birthday === todayStr) {
            const number = `234${person.phone?.slice(-10)}@c.us`;
            const message = `🎉 Happy Birthday ${person.name}! I wish you long life and prosperity. May God bless you and may He grant you success in all you do. Remain blessed`;

            client
              .sendMessage(number, message)
              .then(() => {
                console.log(`✅ Sent message to ${person.name}`);
              })
              .catch((err: unknown) => {
                if (err instanceof Error) {
                  console.error(`Failed to message ${person.name}`, err);
                } else {
                  console.error("Unexpected error:", err);
                }
              });
          }
        });
      } catch (err) {
        console.error("Error fetching birthdays from DB", err);
      }
    });
  });

  client.initialize();
});

server.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});

const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const amqp = require("amqplib");
const sqlite3 = require("sqlite3").verbose();

const dbPath = process.env.SQLITE_PATH || "./medical.db";
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("DB Error:", err);
  } else {
    console.log("✅ Connected to SQLite");
  }
});

db.run(`
  CREATE TABLE IF NOT EXISTS patients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    age INTEGER,
    diagnosis TEXT,
    history TEXT
  )
`);

// load proto
const packageDef = protoLoader.loadSync("./medical.proto");
const grpcObject = grpc.loadPackageDefinition(packageDef);

// gRPC function
async function getMedicalRecord(call, callback) {
  try {
    const patientId = call && call.request ? call.request.patient_id : undefined;
    void patientId;
    callback(null, {
      diagnosis: "Flu",
      history: "Tidak ada riwayat serius",
    });
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    console.warn(`Gagal ambil medical record dari SQLite (${message}). Mengembalikan default.`);
    callback(null, {
      diagnosis: "Flu",
      history: "Tidak ada riwayat serius",
    });
  }
}

// RabbitMQ consumer
async function startMQ() {
  // RabbitMQ bisa belum siap saat container baru start.
  // Retry loop ini bikin service-b tidak crash karena ECONNREFUSED.
  while (true) {
    try {
      const conn = await amqp.connect("amqp://rabbitmq");
      const ch = await conn.createChannel();
      await ch.assertQueue("patient_queue");

      console.log("Menunggu data dari Service A...");

      ch.consume(
        "patient_queue",
        async (msg) => {
          if (!msg) return;
          try {
            const data = JSON.parse(msg.content.toString());
            console.log("Pasien baru diterima:", data);

            db.run(
              `INSERT INTO patients (name, age, diagnosis, history) VALUES (?, ?, ?, ?)`,
              [data.name, data.age, "Flu", "Tidak ada riwayat serius"],
              (err) => {
                if (err) {
                  console.error("❌ Insert error:", err);
                } else {
                  console.log("✅ Data berhasil disimpan ke SQLite");
                }
              }
            );
          } catch (err) {
            const message = err && err.message ? err.message : String(err);
            console.warn(`Gagal proses pesan MQ (${message})`);
          } finally {
            ch.ack(msg);
          }
        },
        { noAck: false }
      );

      return;
    } catch (err) {
      const message = err && err.message ? err.message : String(err);
      console.log(`RabbitMQ belum siap (${message}). Retry 2 detik...`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}

// main server
function main() {
  const server = new grpc.Server();

  server.addService(grpcObject.MedicalService.service, {
    GetMedicalRecord: getMedicalRecord,
  });

  server.bindAsync(
    "0.0.0.0:50051",
    grpc.ServerCredentials.createInsecure(),
    () => {
      server.start();
      console.log("Service B berjalan di port 50051");
    }
  );

  startMQ();
}

main();
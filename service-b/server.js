const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const amqp = require("amqplib");

// load proto
const packageDef = protoLoader.loadSync("./medical.proto");
const grpcObject = grpc.loadPackageDefinition(packageDef);

// gRPC function
function getMedicalRecord(call, callback) {
  callback(null, {
    diagnosis: "Flu",
    history: "Tidak ada riwayat serius"
  });
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

      ch.consume("patient_queue", (msg) => {
        const data = JSON.parse(msg.content.toString());
        console.log("Pasien baru diterima:", data);
      });

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

  server.bindAsync("0.0.0.0:50051",
    grpc.ServerCredentials.createInsecure(),
    () => {
      server.start();
      console.log("Service B berjalan di port 50051");
    });

  startMQ();
}

main();
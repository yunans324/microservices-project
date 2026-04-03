const express = require("express");
const amqp = require("amqplib");
const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");

const app = express();
app.use(express.json());

// Allow simple local frontend to call this API from another origin (e.g. Live Server).
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// load proto
const packageDef = protoLoader.loadSync("./medical.proto");
const grpcObject = grpc.loadPackageDefinition(packageDef);

// gRPC client
const client = new grpcObject.MedicalService(
  "service-b:50051",
  grpc.credentials.createInsecure()
);

app.post("/register", async (req, res) => {
  const data = req.body;

  // kirim ke MQ
  const conn = await amqp.connect("amqp://rabbitmq");
  const ch = await conn.createChannel();
  await ch.assertQueue("patient_queue");

  ch.sendToQueue("patient_queue", Buffer.from(JSON.stringify(data)));

  // gRPC call
  client.GetMedicalRecord({ patient_id: 1 }, (err, response) => {
    res.json({
      status: "success",
      grpc_data: response
    });
  });
});

app.listen(3000, () => {
  console.log("Service A running on port 3000");
});
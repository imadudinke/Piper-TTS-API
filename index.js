const express = require("express");
const { execFile } = require("child_process");
const fs = require("fs");
const path = require("path");

const app = express();
const port = 5000;

app.use(express.json());

app.post("/synthesize", (req, res) => {
    const text = req.body.text;
    if (!text) {
        return res.status(400).send("Text is required.");
    }

    const outputFilePath = path.join(__dirname, "output.wav");
    // Updated paths for the working Piper binary
    const piperPath = "./piper_total/piper_new"; // New working binary
    const modelPath = "./piper_total/en_US-lessac-medium.onnx"; // Model file

    const commandArgs = [
        "-m",
        modelPath,
        "-f",
        outputFilePath,
        "--espeak_data",
        "./piper_total/piper/espeak-ng-data", // Add espeak data path
        "--sentence-silence-seconds",
        "0.5", // Optional: adds a pause between sentences
    ];

    // This is important for piping the text into Piper
    const env = { ...process.env, LD_LIBRARY_PATH: './piper_total/piper:' + (process.env.LD_LIBRARY_PATH || '') };
    const child = execFile(piperPath, commandArgs, { env }, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error executing Piper: ${stderr}`);
            return res.status(500).send("TTS synthesis failed.");
        }

        res.sendFile(outputFilePath, (err) => {
            if (err) {
                console.error("Error sending file:", err);
            }
            fs.unlink(outputFilePath, (unlinkErr) => {
                if (unlinkErr)
                    console.error("Error deleting temp file:", unlinkErr);
            });
        });
    });

    // Write the text to the Piper process's stdin
    child.stdin.write(text + "\n");
    child.stdin.end();
});

app.listen(port, '0.0.0.0', () => {
    console.log(`TTS API listening at http://0.0.0.0:${port}`);
});

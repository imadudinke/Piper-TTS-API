const express = require("express");
const cors = require("cors");
const { execFile } = require("child_process");
const fs = require("fs");
const path = require("path");

const app = express();
const port = process.env.PORT || 5000;

// Enable CORS for all routes to allow external websites to use the API
app.use(cors());
app.use(express.json());

// Health check endpoint for Docker and monitoring
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        service: 'TTS API',
        version: '1.0.0'
    });
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        message: 'TTS API is running',
        endpoints: {
            health: '/health',
            synthesize: '/synthesize (POST)'
        }
    });
});

app.post("/synthesize", (req, res) => {
    const text = req.body.text;
    if (!text) {
        return res.status(400).send("Text is required.");
    }

    // Create unique output file for concurrent requests
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);
    const outputFilePath = path.join(__dirname, `temp/output_${timestamp}_${randomId}.wav`);
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

// Ensure temp directory exists
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}

app.listen(port, '0.0.0.0', () => {
    console.log(`🎤 TTS API listening at http://0.0.0.0:${port}`);
    console.log(`📁 Temp directory: ${tempDir}`);
    console.log(`🔊 Piper binary: ${path.join(__dirname, 'piper_total/piper_new')}`);
    console.log(`✅ Environment: ${process.env.NODE_ENV || 'development'}`);
});

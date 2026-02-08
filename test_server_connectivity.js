const fs = require('fs');
const path = require('path');
const http = require('http');

// Create a dummy PDF file
const dummyPdfPath = path.join(__dirname, 'dummy.pdf');
fs.writeFileSync(dummyPdfPath, '%PDF-1.4\n%EOF');

const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';

const postDataHead = `--${boundary}\r\nContent-Disposition: form-data; name="document"; filename="dummy.pdf"\r\nContent-Type: application/pdf\r\n\r\n`;
const postDataTail = `\r\n--${boundary}--`;

const fileContent = fs.readFileSync(dummyPdfPath);

const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/analysis/upload-file',
    method: 'POST',
    headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': Buffer.byteLength(postDataHead) + fileContent.length + Buffer.byteLength(postDataTail)
    }
};

console.log("🚀 Testing Backend Upload Endpoint...");

const req = http.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    console.log(`HEADERS: ${JSON.stringify(res.headers)}`);

    let chunks = [];
    res.on('data', (chunk) => {
        chunks.push(chunk);
    });

    res.on('end', () => {
        const body = Buffer.concat(chunks).toString();
        console.log(`BODY: ${body}`);
        // Cleanup
        try { fs.unlinkSync(dummyPdfPath); } catch (e) { }
    });
});

req.on('error', (e) => {
    console.error(`problem with request: ${e.message}`);
    // Cleanup
    try { fs.unlinkSync(dummyPdfPath); } catch (e) { }
});

// Write data
req.write(postDataHead);
req.write(fileContent);
req.write(postDataTail);
req.end();

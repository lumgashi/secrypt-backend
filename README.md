<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body>

<h1 align="center">Secrypt</h1>
<p align="center">Secure, private, and controlled file sharing. Protect your files with optional password encryption, time-limited access, and download limitations.</p>

<h2>About Secrypt</h2>
<p>Secrypt is a secure file-sharing platform built using NestJS, Prisma, and MongoDB with S3 file storage. Designed to prioritize privacy and control, Secrypt allows users to share files with expiration dates, download limits, and optional password protection.</p>

<h2>Features</h2>
<ul>
  <li>Supports multiple file types: images, videos, documents, PDFs, and archives</li>
  <li>Set an expiration time or download limit for each file</li>
  <li>Optional password protection for additional security</li>
  <li>End-to-end encryption for secure file sharing (future update)</li>
</ul>

<h2>Tech Stack</h2>
<ul>
  <li><b>NestJS</b> - Server framework for building scalable Node.js applications</li>
  <li><b>Prisma</b> - ORM for MongoDB for seamless data management</li>
  <li><b>MongoDB</b> - Database for storing file metadata</li>
  <li><b>Amazon S3</b> - Cloud storage for managing files</li>
</ul>

<h2>Installation</h2>
<pre>
<code>git clone https://github.com/your-username/secrypt.git
cd secrypt
npm install
</code>
</pre>

<h3>Environment Variables</h3>
<p>Create a <code>.env</code> file in the root directory and add the following variables:</p>
<pre>
<code>AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_BUCKET_NAME=your_bucket_name
DATABASE_URL=your_database_url
BASE_URL=http://localhost:3000  <!-- or your deployment URL -->
</code>
</pre>

<h2>Usage</h2>
<ol>
  <li>Run the server locally with <code>npm run start:dev</code>.</li>
  <li>Use a tool like Postman or your client to test file upload, access, and download.</li>
</ol>

<h2>Contributing</h2>
<p>Contributions are welcome! Please open issues or submit pull requests for any improvements.</p>

<h2>License</h2>
<p>MIT License</p>

<h2>Contact</h2>
<p>For questions or suggestions, reach out at <a href="mailto:your-email@example.com">your-email@example.com</a></p>

</body>
</html>

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import Busboy from 'busboy';
import { v4 as uuidv4 } from 'uuid';

const s3Client = new S3Client({ region: 'ca-central-1' });

// Define the bucket name to save the image
const BUCKET_NAME = 'potp-gallery';

export const uploadImage = async (event) => {
    try {
        const { headers } = event;
        const contentType = headers['Content-Type'] || headers['content-type'];

        if (!contentType || !contentType.startsWith('multipart/form-data')) {
            throw new Error('Invalid content-type, expected multipart/form-data');
        }

        const busboy = Busboy({ headers });
        const formData = {};

        await new Promise((resolve, reject) => {
            busboy.on('file', (name, file, info) => {
                const { filename, encoding, mimeType } = info;
                console.log(`File [${name}]: filename: %j, encoding: %j, mimeType: %j`, filename, encoding, mimeType);
                const fileChunks = [];

                file.on('data', (data) => {
                    console.log(`File [${name}] got ${data.length} bytes`);
                    fileChunks.push(data);
                });

                file.on('close', () => {
                    console.log(`File [${name}] done`);
                    formData[name] = {
                        filename,
                        content: Buffer.concat(fileChunks),
                        contentType: mimeType,
                    };
                });
            });

            busboy.on('field', (name, val, info) => {
                console.log(`Field [${name}]: value: %j`, val);
                formData[name] = val;
            });

            busboy.on('close', () => {
                console.log('Done parsing form!');
                resolve();
            });

            busboy.on('error', reject);

            busboy.end(Buffer.from(event.body, 'base64'));
        });

        const imageFile = formData['image'];
        const memberData = JSON.parse(formData['data']);

        if (!imageFile || !imageFile.content) {
            throw new Error('No image file provided in the request');
        }

        memberData.image = `${uuidv4()}.jpg`;

        // Prepare S3 upload parameters
        const params = {
            Bucket: BUCKET_NAME,
            Key: memberData.image,
            Body: imageFile.content,
            ContentType: imageFile.contentType,
        };

        // Upload image to S3
        const command = new PutObjectCommand(params);
        const s3Response = await s3Client.send(command);

        return {
            statusCode: 200,
            body: {
                memberData,
            },
        };
    } catch (error) {
        console.error('Error handling the request:', error);
        return {
            statusCode: 500,
            body: { message: 'Failed to upload image', error: error.message },
        };
    }
};
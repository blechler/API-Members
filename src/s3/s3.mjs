import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

const s3Client = new S3Client({ region: 'ca-central-1' });

async function uploadImage(event) {
    try {
        const { image, path } = JSON.parse(event.body);

        if (!image || !path) {
            return {
                statusCode: 400,
                body: {
                    message: 'Image and path are required'
                }
            };
        }

        const fileExtension = image.split(';')[0].split('/')[1];
        const fileName = `${uuidv4()}.${fileExtension}`;
        const folderPath = `content${path}`;
        const bucketName = 'img.potp.org';

        const params = {
            Bucket: bucketName,
            Key: `${folderPath}/${fileName}`,
            Body: Buffer.from(image.split(',')[1], 'base64'),
            ContentType: `image/${fileExtension}`
        };

        const data = await s3Client.send(new PutObjectCommand(params));
        return {
            statusCode: 200,
            body: { path: `${folderPath}/${fileName}`, data }
        };
    } catch (err) {
        return {
            statusCode: 500,
            body: { message: 'Image upload failed', error: err.message }
        };
    }
}

export { uploadImage };
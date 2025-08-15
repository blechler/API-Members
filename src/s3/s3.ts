import { APIGatewayProxyEvent } from 'aws-lambda';
import { S3Client, PutObjectCommand, HeadObjectCommand, CopyObjectCommand } from '@aws-sdk/client-s3';
import Busboy from 'busboy';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';

const s3Client = new S3Client({ region: 'ca-central-1' });

const BUCKET_NAME = 'potp-gallery';

interface ApiResponse {
    statusCode: number;
    body: any;
}

interface FormData {
    [key: string]: any;
}

interface FileData {
    filename: string;
    content: Buffer;
    contentType: string;
}

interface Member {
    id?: string;
    image?: string;
}

const _busBoyThis = async (event: APIGatewayProxyEvent): Promise<FormData> => {
    const { headers } = event;
    const contentType = headers['Content-Type'] || headers['content-type'];

    if (!contentType || !contentType.startsWith('multipart/form-data')) {
        throw new Error('Invalid content-type, expected multipart/form-data');
    }

    const busboy = Busboy({ headers });
    const formData: FormData = {};

    await new Promise<void>((resolve, reject) => {
        busboy.on('file', (name: string, file: NodeJS.ReadableStream, info: any) => {
            const { filename, encoding, mimeType } = info;
            console.log(`File [${name}]: filename: %j, encoding: %j, mimeType: %j`, filename, encoding, mimeType);
            const fileChunks: Buffer[] = [];

            file.on('data', (data: Buffer) => {
                console.log(`File [${name}] got ${data.length} bytes`);
                fileChunks.push(data);
            });

            file.on('close', () => {
                console.log(`File [${name}] done`);
                formData[name] = {
                    filename,
                    content: Buffer.concat(fileChunks),
                    contentType: mimeType,
                } as FileData;
            });
        });

        busboy.on('field', (name: string, val: string, info: any) => {
            console.log(`Field [${name}]: value: %j`, val);
            formData[name] = val;
        });

        busboy.on('finish', () => {
            console.log('Done parsing form!');
            resolve();
        });

        busboy.on('error', reject);

        if (event.isBase64Encoded) {
            busboy.end(Buffer.from(event.body || '', 'base64'));
        } else {
            busboy.end(event.body);
        }
    });

    return formData;
};

/**
 * Resize image buffer to specified dimensions using Sharp
 */
const resizeImage = async (imageBuffer: Buffer, width: number, height: number): Promise<Buffer> => {
    try {
        return await sharp(imageBuffer)
            .resize(width, height, {
                fit: 'cover', // Crop to exact dimensions
                position: 'center'
            })
            .jpeg({ quality: 90 }) // Convert to JPEG with good quality
            .toBuffer();
    } catch (error) {
        console.error('Error resizing image:', error);
        throw new Error('Failed to resize image');
    }
};

export const setMeta = async (imageName: string, newMetadata: Record<string, string>): Promise<ApiResponse> => {
    try {
        const headParams = {
            Bucket: BUCKET_NAME,
            Key: imageName,
        };

        const headResponse = await s3Client.send(new HeadObjectCommand(headParams));
        const oldMetadata = headResponse.Metadata || {};

        const combinedMetadata = { ...oldMetadata, ...newMetadata };

        const copyParams = {
            Bucket: BUCKET_NAME,
            CopySource: `${BUCKET_NAME}/${imageName}`,
            Key: imageName,
            Metadata: combinedMetadata,
            MetadataDirective: 'REPLACE' as const,
        };

        await s3Client.send(new CopyObjectCommand(copyParams));

        return {
            statusCode: 200,
            body: { message: 'Metadata updated successfully' },
        };
    } catch (error) {
        console.error('Error updating metadata:', error);
        return {
            statusCode: 500,
            body: { message: 'Failed to update metadata', error: (error as Error).message },
        };
    }
};

export const updateImage = async (event: APIGatewayProxyEvent, objMember?: Member): Promise<ApiResponse> => {
    try {
        const formData = await _busBoyThis(event);

        const imageFile = formData['image'] as FileData;
        const memberData = JSON.parse(formData['data']);

        if (!imageFile || !imageFile.content) {
            throw new Error('No image file provided in the request');
        }

        if (!imageFile.filename) {
            throw new Error('Image file name is required');
        }

        // Accept any image type - will be converted to JPEG during resize

        if (!objMember?.image) {
            throw new Error('Member image name is required');
        }

        const headParams = {
            Bucket: BUCKET_NAME,
            Key: objMember.image,
        };

        try {
            await s3Client.send(new HeadObjectCommand(headParams));
        } catch (err: any) {
            if (err.name === 'NotFound') {
                return {
                    statusCode: 404,
                    body: { message: 'Object does not exist, cannot update' },
                };
            }
            throw err;
        }

        // Resize image to 300x500
        const resizedImageBuffer = await resizeImage(imageFile.content, 300, 500);

        const params = {
            Bucket: BUCKET_NAME,
            Key: objMember.image,
            Body: resizedImageBuffer,
            ContentType: 'image/jpeg', // Always JPEG after processing
            Metadata: {
                member: objMember.id || '',
            },
        };

        const command = new PutObjectCommand(params);
        await s3Client.send(command);

        return {
            statusCode: 200,
            body: {
                objMember,
            },
        };
    } catch (error) {
        console.error('Error handling the request:', error);
        return {
            statusCode: 500,
            body: { message: 'Failed to upload image', error: (error as Error).message },
        };
    }
};

export const uploadImage = async (event: APIGatewayProxyEvent): Promise<ApiResponse> => {
    try {
        const formData = await _busBoyThis(event);

        const imageFile = formData['image'] as FileData;
        const memberData = JSON.parse(formData['data']);

        if (!imageFile || !imageFile.content) {
            throw new Error('No image file provided in the request');
        }

        memberData.image = `${uuidv4()}.jpg`;

        // Resize image to 300x500
        const resizedImageBuffer = await resizeImage(imageFile.content, 300, 500);

        const params = {
            Bucket: BUCKET_NAME,
            Key: memberData.image,
            Body: resizedImageBuffer,
            ContentType: 'image/jpeg', // Always JPEG after processing
        };

        const command = new PutObjectCommand(params);
        await s3Client.send(command);

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
            body: { message: 'Failed to upload image', error: (error as Error).message },
        };
    }
};
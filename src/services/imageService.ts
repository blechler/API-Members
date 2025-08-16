import { S3Client, PutObjectCommand, HeadObjectCommand, CopyObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';

const s3Client = new S3Client({ region: 'ca-central-1' });
const BUCKET_NAME = 'potp-gallery';

export interface ImageUploadResult {
  success: boolean;
  imageUrl?: string;
  error?: string;
}

/**
 * Service class for image operations.
 * Handles image validation, processing, and S3 uploads.
 */
export class ImageService {

  /**
   * Resize image buffer to specified dimensions using Sharp
   */
  private async resizeImage(imageBuffer: Buffer, width: number, height: number): Promise<Buffer> {
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
  }

  /**
   * Validate and upload image to S3
   */
  async validateAndUploadImageToS3(imageBuffer: Buffer, originalFilename: string): Promise<ImageUploadResult> {
    try {
      console.log(`Processing image upload: ${originalFilename}, size: ${imageBuffer.length} bytes`);

      // Resize image to 300x500
      const resizedImageBuffer = await this.resizeImage(imageBuffer, 300, 500);
      
      // Generate unique filename
      const s3Key = `${uuidv4()}.jpg`;

      const params = {
        Bucket: BUCKET_NAME,
        Key: s3Key,
        Body: resizedImageBuffer,
        ContentType: 'image/jpeg', // Always JPEG after processing
      };

      const command = new PutObjectCommand(params);
      await s3Client.send(command);

      console.log(`Image uploaded successfully as: ${s3Key}`);
      return {
        success: true,
        imageUrl: s3Key
      };
    } catch (error) {
      console.error('Error uploading image:', error);
      return {
        success: false,
        error: `Failed to upload image: ${(error as Error).message}`
      };
    }
  }

  /**
   * Update existing image in S3
   */
  async updateImageInS3(imageBuffer: Buffer, existingImageKey: string, memberId?: string): Promise<ImageUploadResult> {
    try {
      console.log(`Updating existing image: ${existingImageKey}, size: ${imageBuffer.length} bytes`);

      // Check if existing image exists
      const headParams = {
        Bucket: BUCKET_NAME,
        Key: existingImageKey,
      };

      try {
        await s3Client.send(new HeadObjectCommand(headParams));
      } catch (err: any) {
        if (err.name === 'NotFound') {
          return {
            success: false,
            error: 'Image does not exist, cannot update'
          };
        }
        throw err;
      }

      // Resize image to 300x500
      const resizedImageBuffer = await this.resizeImage(imageBuffer, 300, 500);

      const params = {
        Bucket: BUCKET_NAME,
        Key: existingImageKey,
        Body: resizedImageBuffer,
        ContentType: 'image/jpeg', // Always JPEG after processing
        Metadata: {
          member: memberId || '',
        },
      };

      const command = new PutObjectCommand(params);
      await s3Client.send(command);

      console.log(`Image updated successfully: ${existingImageKey}`);
      return {
        success: true,
        imageUrl: existingImageKey
      };
    } catch (error) {
      console.error('Error updating image:', error);
      return {
        success: false,
        error: `Failed to update image: ${(error as Error).message}`
      };
    }
  }

  /**
   * Set metadata on existing S3 object
   */
  async setImageMetadata(imageName: string, newMetadata: Record<string, string>): Promise<{ success: boolean; error?: string }> {
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

      return { success: true };
    } catch (error) {
      console.error('Error updating metadata:', error);
      return {
        success: false,
        error: `Failed to update metadata: ${(error as Error).message}`
      };
    }
  }
}
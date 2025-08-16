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

export interface FileType {
  mimeType: string;
  extension: string;
  isVideo: boolean;
}

/**
 * Service class for image and video operations.
 * Handles image/video validation, processing, and S3 uploads.
 */
export class ImageService {

  /**
   * Determine file type based on content analysis
   */
  private getFileType(_buffer: Buffer, originalFilename: string): FileType {
    const filename = originalFilename.toLowerCase();
    
    // Check for video files
    if (filename.endsWith('.mp4')) {
      return {
        mimeType: 'video/mp4',
        extension: 'mp4',
        isVideo: true
      };
    }
    
    // Default to image handling
    return {
      mimeType: 'image/jpeg',
      extension: 'jpg',
      isVideo: false
    };
  }

  /**
   * Validate video file size (1MB limit)
   */
  private validateVideoSize(buffer: Buffer): void {
    const maxSize = 1024 * 1024; // 1MB
    if (buffer.length > maxSize) {
      throw new Error('Video file must be smaller than 1MB');
    }
  }

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
   * Validate and upload image or video to S3
   */
  async validateAndUploadImageToS3(fileBuffer: Buffer, originalFilename: string): Promise<ImageUploadResult> {
    try {
      console.log(`Processing file upload: ${originalFilename}, size: ${fileBuffer.length} bytes`);

      const fileType = this.getFileType(fileBuffer, originalFilename);
      let processedBuffer: Buffer;
      let s3Key: string;

      if (fileType.isVideo) {
        // Handle video files
        this.validateVideoSize(fileBuffer);
        processedBuffer = fileBuffer; // No processing for videos
        s3Key = `${uuidv4()}.${fileType.extension}`;
      } else {
        // Handle image files
        processedBuffer = await this.resizeImage(fileBuffer, 300, 500);
        s3Key = `${uuidv4()}.jpg`;
      }

      const params = {
        Bucket: BUCKET_NAME,
        Key: s3Key,
        Body: processedBuffer,
        ContentType: fileType.mimeType,
      };

      const command = new PutObjectCommand(params);
      await s3Client.send(command);

      console.log(`File uploaded successfully as: ${s3Key}`);
      return {
        success: true,
        imageUrl: s3Key
      };
    } catch (error) {
      console.error('Error uploading file:', error);
      return {
        success: false,
        error: `Failed to upload file: ${(error as Error).message}`
      };
    }
  }

  /**
   * Update existing image or video in S3
   */
  async updateImageInS3(fileBuffer: Buffer, existingImageKey: string, memberId?: string): Promise<ImageUploadResult> {
    try {
      console.log(`Updating existing file: ${existingImageKey}, size: ${fileBuffer.length} bytes`);

      // Check if existing file exists
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
            error: 'File does not exist, cannot update'
          };
        }
        throw err;
      }

      const fileType = this.getFileType(fileBuffer, existingImageKey);
      let processedBuffer: Buffer;

      if (fileType.isVideo) {
        // Handle video files
        this.validateVideoSize(fileBuffer);
        processedBuffer = fileBuffer; // No processing for videos
      } else {
        // Handle image files
        processedBuffer = await this.resizeImage(fileBuffer, 300, 500);
      }

      const params = {
        Bucket: BUCKET_NAME,
        Key: existingImageKey,
        Body: processedBuffer,
        ContentType: fileType.mimeType,
        Metadata: {
          member: memberId || '',
        },
      };

      const command = new PutObjectCommand(params);
      await s3Client.send(command);

      console.log(`File updated successfully: ${existingImageKey}`);
      return {
        success: true,
        imageUrl: existingImageKey
      };
    } catch (error) {
      console.error('Error updating file:', error);
      return {
        success: false,
        error: `Failed to update file: ${(error as Error).message}`
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
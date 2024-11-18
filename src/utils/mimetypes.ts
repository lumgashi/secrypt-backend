export enum MIME_TYPES {
  DOC = 'application/msword',
  DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  JPG = 'image/jpg',
  JPEG = 'image/jpeg',
  PNG = 'image/png',
  GIF = 'image/gif',
  ZIP = 'application/zip',
  RAR = 'application/x-rar-compressed',
  PDF = 'application/pdf',
  MP4 = 'video/mp4',
  MP3 = 'audio/mpeg',
  MOV = 'video/quicktime',
  AVI = 'video/x-msvideo',
  MKV = 'video/x-matroska',
  PPTX = 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  XLSX = 'application/vnd.ms-excel',
}

export const MIME_TYPES_ARRAY = Object.values(MIME_TYPES);
export const MIME_TYPES_KEYS = Object.keys(MIME_TYPES);

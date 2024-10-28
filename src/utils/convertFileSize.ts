export const convertFileSize = (bytes: number): number => {
  const fileSizeInBytes = bytes;
  const fileSizeInKB = fileSizeInBytes / 1024;
  const fileSizeInMB = fileSizeInKB / 1024;
  return Number(fileSizeInMB.toFixed(2));
};

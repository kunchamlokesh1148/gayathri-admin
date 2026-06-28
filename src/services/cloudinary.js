/**
 * Uploads an image file directly to Cloudinary using unsigned upload presets.
 * 
 * @param {File} file - The file object to upload
 * @param {string} [cloudName] - Optional custom Cloudinary cloud name
 * @param {string} [uploadPreset] - Optional custom Cloudinary upload preset
 * @returns {Promise<string>} Secure URL of the uploaded image
 */
export const uploadImageToCloudinary = async (file, cloudName, uploadPreset) => {
  const cName = cloudName || import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const cPreset = uploadPreset || import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

  if (!cName || !cPreset || cName === 'YOUR_CLOUD_NAME' || cPreset === 'YOUR_UPLOAD_PRESET' || cName.trim() === '') {
    throw new Error("Cloudinary configuration missing. Please check your environment variables.");
  }

  const url = `https://api.cloudinary.com/v1_1/${cName}/image/upload`;
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', cPreset);

  const response = await fetch(url, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || 'Failed to upload image to Cloudinary');
  }

  const data = await response.json();
  return data.secure_url;
};

/**
 * Uploads an image file directly to Cloudinary using unsigned upload presets.
 * If credentials are missing, falls back to reading file as DataURL for local preview.
 * 
 * @param {File} file - The file object to upload
 * @param {string} [cloudName] - Optional custom Cloudinary cloud name
 * @param {string} [uploadPreset] - Optional custom Cloudinary upload preset
 * @returns {Promise<string>} Secure URL of the uploaded image
 */
export const uploadImageToCloudinary = async (file, cloudName, uploadPreset) => {
  const cName = cloudName || import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const cPreset = uploadPreset || import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

  // Fallback to local DataURL for mock/development mode
  if (!cName || !cPreset || cName === 'YOUR_CLOUD_NAME' || cPreset === 'YOUR_UPLOAD_PRESET' || cName.trim() === '') {
    console.warn("Cloudinary configuration missing. Falling back to local data URL for rendering.");
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(reader.result);
      };
      reader.onerror = () => {
        reject(new Error("Failed to read local file"));
      };
      reader.readAsDataURL(file);
    });
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

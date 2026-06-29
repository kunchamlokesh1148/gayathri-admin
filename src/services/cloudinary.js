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
  const url = `https://api.cloudinary.com/v1_1/${cName || 'undefined'}/image/upload`;

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

  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', cPreset);

    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    });

    let responseJson = null;
    try {
      responseJson = await response.json();
    } catch (jsonErr) {
      // Ignore JSON parse error if body is not JSON
    }

    if (!response.ok) {
      const apiErrorMsg = responseJson?.error?.message || `Upload failed with status code ${response.status}`;
      const friendlyErrorMsg = `Upload failed: ${apiErrorMsg}`;
      console.error("Cloudinary Debug Info:", {
        "Cloudinary URL": url,
        "Upload Preset": cPreset,
        "Cloud Name": cName,
        "HTTP Status": response.status,
        "Response JSON": responseJson,
        "Error Message": apiErrorMsg
      });
      throw new Error(friendlyErrorMsg);
    }

    return responseJson.secure_url;
  } catch (err) {
    if (!err.message.includes("Cloudinary configuration missing") && !err.message.includes("Upload failed:")) {
      console.error("Cloudinary Debug Info:", {
        "Cloudinary URL": url,
        "Upload Preset": cPreset,
        "Cloud Name": cName,
        "HTTP Status": "Network Error / Exception",
        "Response JSON": "N/A",
        "Error Message": err.message
      });
      throw new Error(`Upload failed: ${err.message}`);
    }
    throw err;
  }
};

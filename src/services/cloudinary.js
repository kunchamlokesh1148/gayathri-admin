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
    const errorMsg = "Cloudinary configuration missing. Please verify VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET in your environment variables.";
    console.error("Cloudinary Debug Info:", {
      "Cloudinary URL": url,
      "Upload Preset": cPreset || 'undefined',
      "Cloud Name": cName || 'undefined',
      "HTTP Status": "N/A",
      "Response JSON": "N/A",
      "Error Message": errorMsg
    });
    throw new Error(errorMsg);
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

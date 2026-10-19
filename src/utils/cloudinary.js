const cloudinary = require('cloudinary').v2;

/**
 * Checks if all required Cloudinary environment variables are configured and non-empty.
 */
function isCloudinaryConfigured(env = process.env) {
  return Boolean(
    env &&
    env.CLOUDINARY_CLOUD_NAME &&
    String(env.CLOUDINARY_CLOUD_NAME).trim() &&
    env.CLOUDINARY_API_KEY &&
    String(env.CLOUDINARY_API_KEY).trim() &&
    env.CLOUDINARY_API_SECRET &&
    String(env.CLOUDINARY_API_SECRET).trim()
  );
}

/**
 * Ensures Cloudinary SDK is initialized with environment variables if configured.
 */
function configureCloudinary() {
  if (isCloudinaryConfigured()) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
  }
}

/**
 * Extracts public_id from a Cloudinary secure or standard URL.
 * Supports URLs with version prefixes, folders, and transformations.
 */
function extractPublicId(url) {
  if (!url || typeof url !== 'string' || !url.includes('res.cloudinary.com')) {
    return null;
  }

  const uploadIndex = url.indexOf('/upload/');
  if (uploadIndex === -1) {
    return null;
  }

  let pathPart = url.substring(uploadIndex + '/upload/'.length);
  pathPart = pathPart.split('?')[0].split('#')[0];

  const versionMatch = pathPart.match(/(?:^|\/)v\d+\/(.+)$/);
  let publicIdWithExt;
  if (versionMatch) {
    publicIdWithExt = versionMatch[1];
  } else {
    const segments = pathPart.split('/');
    let startIndex = 0;
    while (startIndex < segments.length && /^[a-z]{1,2}_[a-zA-Z0-9_,]+$/.test(segments[startIndex])) {
      startIndex++;
    }
    publicIdWithExt = segments.slice(startIndex).join('/');
  }

  const lastDotIndex = publicIdWithExt.lastIndexOf('.');
  if (lastDotIndex !== -1) {
    return publicIdWithExt.substring(0, lastDotIndex);
  }

  return publicIdWithExt;
}

/**
 * Uploads a file buffer directly to Cloudinary using upload_stream.
 */
function uploadToCloudinary(buffer, options = {}) {
  configureCloudinary();
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'social_posts',
        resource_type: 'image',
        ...options,
      },
      (error, result) => {
        if (error) {
          return reject(error);
        }
        resolve(result);
      }
    );

    uploadStream.end(buffer);
  });
}

/**
 * Deletes an asset from Cloudinary given its public_id or full URL.
 */
async function deleteFromCloudinary(publicIdOrUrl) {
  configureCloudinary();
  if (!publicIdOrUrl) return null;

  const publicId = publicIdOrUrl.includes('res.cloudinary.com')
    ? extractPublicId(publicIdOrUrl)
    : publicIdOrUrl;

  if (!publicId) return null;

  return await cloudinary.uploader.destroy(publicId);
}

module.exports = {
  cloudinary,
  isCloudinaryConfigured,
  extractPublicId,
  uploadToCloudinary,
  deleteFromCloudinary,
};

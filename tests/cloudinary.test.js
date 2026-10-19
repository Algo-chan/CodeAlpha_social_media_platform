const {
  extractPublicId,
  isCloudinaryConfigured,
  uploadToCloudinary,
  deleteFromCloudinary,
} = require('../src/utils/cloudinary');
const cloudinary = require('cloudinary');

describe('Cloudinary Integration Helper', () => {
  describe('extractPublicId', () => {
    it('extracts public ID from Cloudinary secure URL with folder and version', () => {
      const url = 'https://res.cloudinary.com/demo/image/upload/v1612345678/social_posts/sample_post_123.jpg';
      expect(extractPublicId(url)).toBe('social_posts/sample_post_123');
    });

    it('extracts public ID from Cloudinary URL without folder', () => {
      const url = 'https://res.cloudinary.com/demo/image/upload/v1612345678/sample_post_123.jpg';
      expect(extractPublicId(url)).toBe('sample_post_123');
    });

    it('extracts public ID from Cloudinary URL without version prefix', () => {
      const url = 'https://res.cloudinary.com/demo/image/upload/social_posts/sample_post_123.png';
      expect(extractPublicId(url)).toBe('social_posts/sample_post_123');
    });

    it('extracts public ID when URL has transformation segments', () => {
      const url = 'https://res.cloudinary.com/demo/image/upload/c_scale,w_500/v1612345678/social_posts/nested/sample.png';
      expect(extractPublicId(url)).toBe('social_posts/nested/sample');
    });

    it('returns null or empty for non-cloudinary URLs or invalid inputs', () => {
      expect(extractPublicId('/uploads/local_file.jpg')).toBeNull();
      expect(extractPublicId('https://example.com/images/cat.png')).toBeNull();
      expect(extractPublicId('')).toBeNull();
      expect(extractPublicId(null)).toBeNull();
    });
  });

  describe('isCloudinaryConfigured', () => {
    it('detects if Cloudinary is configured via environment', () => {
      expect(isCloudinaryConfigured({})).toBe(false);
      expect(
        isCloudinaryConfigured({
          CLOUDINARY_CLOUD_NAME: 'c',
          CLOUDINARY_API_KEY: 'k',
          CLOUDINARY_API_SECRET: 's',
        })
      ).toBe(true);
    });

    it('returns false if any required environment variable is missing or blank', () => {
      expect(
        isCloudinaryConfigured({
          CLOUDINARY_CLOUD_NAME: 'c',
          CLOUDINARY_API_KEY: '',
          CLOUDINARY_API_SECRET: 's',
        })
      ).toBe(false);

      expect(
        isCloudinaryConfigured({
          CLOUDINARY_CLOUD_NAME: 'c',
          CLOUDINARY_API_SECRET: 's',
        })
      ).toBe(false);
    });
  });

  describe('uploadToCloudinary and deleteFromCloudinary mocks', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('uploads a buffer to cloudinary using upload_stream', async () => {
      const mockResult = {
        secure_url: 'https://res.cloudinary.com/demo/image/upload/v1/social_posts/test.jpg',
        public_id: 'social_posts/test',
      };

      const mockStream = {
        end: jest.fn(),
      };

      jest.spyOn(cloudinary.v2.uploader, 'upload_stream').mockImplementation((options, callback) => {
        // simulate async callback
        process.nextTick(() => callback(null, mockResult));
        return mockStream;
      });

      const buffer = Buffer.from('fake image content');
      const result = await uploadToCloudinary(buffer, { folder: 'social_posts' });

      expect(result).toEqual(mockResult);
      expect(mockStream.end).toHaveBeenCalledWith(buffer);
    });

    it('deletes an asset from cloudinary using destroy with extracted public_id', async () => {
      const destroySpy = jest
        .spyOn(cloudinary.v2.uploader, 'destroy')
        .mockResolvedValue({ result: 'ok' });

      const url = 'https://res.cloudinary.com/demo/image/upload/v1612345678/social_posts/sample_123.jpg';
      const result = await deleteFromCloudinary(url);

      expect(destroySpy).toHaveBeenCalledWith('social_posts/sample_123');
      expect(result).toEqual({ result: 'ok' });
    });
  });

  describe('Post Service Cloudinary Integration', () => {
    const postService = require('../src/services/post.service');
    const { sequelize, User, Post } = require('../src/models');
    let testUser;

    beforeAll(async () => {
      await sequelize.sync({ force: true });
      testUser = await User.create({
        username: 'clouduser',
        email: 'cloud@example.com',
        password_hash: 'hash123',
      });
    });

    afterAll(async () => {
      await sequelize.close();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('creates post and sets image_url from Cloudinary when file.buffer is present', async () => {
      jest.spyOn(cloudinary.v2.uploader, 'upload_stream').mockImplementation((options, callback) => {
        process.nextTick(() =>
          callback(null, {
            secure_url: 'https://res.cloudinary.com/demo/image/upload/v123456/social_posts/uploaded_buffer.png',
            public_id: 'social_posts/uploaded_buffer',
          })
        );
        return { end: jest.fn() };
      });

      const post = await postService.createPost({
        userId: testUser.id,
        content: 'Post with Cloudinary buffer',
        file: {
          buffer: Buffer.from('fake buffer image'),
          mimetype: 'image/png',
          originalname: 'uploaded_buffer.png',
        },
      });

      expect(post.image_url).toBe(
        'https://res.cloudinary.com/demo/image/upload/v123456/social_posts/uploaded_buffer.png'
      );
    });

    it('deletes Cloudinary asset when deleting a post with a Cloudinary image_url', async () => {
      const destroySpy = jest
        .spyOn(cloudinary.v2.uploader, 'destroy')
        .mockResolvedValue({ result: 'ok' });

      const post = await Post.create({
        user_id: testUser.id,
        content: 'Post to delete with cloud image',
        image_url: 'https://res.cloudinary.com/demo/image/upload/v123456/social_posts/delete_me.png',
      });

      const result = await postService.deletePost({
        postId: post.id,
        userId: testUser.id,
      });

      expect(result).toEqual({ success: true });
      expect(destroySpy).toHaveBeenCalledWith('social_posts/delete_me');
    });
  });
});


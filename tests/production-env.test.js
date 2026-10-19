const fs = require('fs');
const path = require('path');

describe('Production Deployment Assets', () => {
  it('provides .env.production.example with required cloud variables', () => {
    const filePath = path.join(__dirname, '../.env.production.example');
    expect(fs.existsSync(filePath)).toBe(true);
    const envExample = fs.readFileSync(filePath, 'utf8');
    expect(envExample).toContain('DATABASE_URL=');
    expect(envExample).toContain('CLOUDINARY_CLOUD_NAME=');
    expect(envExample).toContain('CLOUDINARY_API_KEY=');
    expect(envExample).toContain('CLOUDINARY_API_SECRET=');
    expect(envExample).toContain('JWT_SECRET=');
    expect(envExample).toContain('NODE_ENV=production');
    expect(envExample).toContain('PORT=');
  });

  it('provides render.yaml deployment configuration', () => {
    const filePath = path.join(__dirname, '../render.yaml');
    expect(fs.existsSync(filePath)).toBe(true);
    const renderYaml = fs.readFileSync(filePath, 'utf8');
    expect(renderYaml).toContain('type: web');
    expect(renderYaml).toContain('buildCommand: npm install');
    expect(renderYaml).toContain('startCommand: npm start');
    expect(renderYaml).toContain('envVars:');
  });
});

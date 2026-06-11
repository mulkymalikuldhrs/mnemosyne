import React, { useState } from 'react';

const ImageUploader = () => {
  const [image, setImage] = useState(null);
  const [imageUrl, setImageUrl] = useState('');

  const handleImageChange = (event: any) => {
    const file = event.target.files[0];
    setImage(file);
    const reader = new FileReader();
    reader.onload = () => {
      setImageUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = () => {
    // Upload image to server
  };

  return (
    <div>
      <input type="file" onChange={handleImageChange} />
      {image && (
        <img src={imageUrl} alt="Uploaded image" />
      )}
      <button onClick={handleUpload}>Upload image</button>
    </div>
  );
};

export default ImageUploader;
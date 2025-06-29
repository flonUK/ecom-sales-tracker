import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';

const OAuthCallback = ({ platform }) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    const processCallback = async () => {
      try {
        const code = searchParams.get('code');
        const error = searchParams.get('error');
        const state = searchParams.get('state');

        if (error) {
          toast.error(`Authorization failed: ${error}`);
          navigate('/connections');
          return;
        }

        if (!code) {
          toast.error('No authorization code received');
          navigate('/connections');
          return;
        }

        // Send the authorization code to our backend
        const response = await axios.post(`/api/${platform}/callback`, {
          code,
          state
        });

        if (response.data.message) {
          toast.success(`${platform.charAt(0).toUpperCase() + platform.slice(1)} connected successfully!`);
        }

        // Redirect back to connections page
        navigate('/connections');

      } catch (error) {
        console.error(`${platform} callback error:`, error);
        toast.error(`Failed to connect ${platform}: ${error.response?.data?.error || error.message}`);
        navigate('/connections');
      } finally {
        setIsProcessing(false);
      }
    };

    processCallback();
  }, [platform, searchParams, navigate]);

  if (isProcessing) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>Connecting to {platform.charAt(0).toUpperCase() + platform.slice(1)}...</p>
      </div>
    );
  }

  return null;
};

export default OAuthCallback; 
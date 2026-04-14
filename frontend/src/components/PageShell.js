import React from 'react';
import { Box } from '@mui/material';

export default function PageShell({ children, maxWidth, paddingTop, style }) {
  return (
    <Box
      sx={{
        maxWidth: maxWidth || 900,
        mx: 'auto',
        pt: paddingTop ? `${paddingTop}px` : '92px',
        px: 2,
        ...style,
      }}
    >
      {children}
    </Box>
  );
}

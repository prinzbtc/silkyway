# Antivirus Integration with ClamAV

This document describes the integration of ClamAV antivirus scanning into the Silkyway marketplace application.

## Overview

The Silkyway marketplace now includes antivirus scanning for all uploaded files to enhance security and protect users from malicious content. This is implemented using ClamAV, an open-source antivirus engine.

## Implementation Details

### Server-Side Components

1. **ClamAV Installation**
   - ClamAV is installed on the server with the following components:
     - `clamav`: Core antivirus engine
     - `clamav-daemon`: Background scanning service
     - `clamav-freshclam`: Virus definitions updater

2. **Antivirus Utility**
   - Location: `/src/lib/antivirus.ts`
   - Provides functions for scanning files and handling infected files
   - Configurable to use either direct `clamscan` or the ClamAV daemon

3. **Upload API Integration**
   - All file upload routes (`handleReportUpload`, `handleListingMediaUpload`, and `handleGeneralUpload`) include antivirus scanning
   - Files are scanned before being processed or stored
   - Infected files are rejected with appropriate error messages

### Configuration

The antivirus integration is configured using the following environment variables:

```
# ClamAV Configuration
CLAMSCAN_PATH=/usr/bin/clamscan
CLAMD_SOCKET=/var/run/clamav/clamd.ctl
USE_CLAMD=false
MOCK_AV_SCAN=false
```

- `CLAMSCAN_PATH`: Path to the ClamAV executable
- `CLAMD_SOCKET`: Path to the ClamAV daemon socket
- `USE_CLAMD`: Set to `true` to use the ClamAV daemon, `false` to use `clamscan` directly
- `MOCK_AV_SCAN`: Set to `true` to enable mock scanning in development (no actual scanning)

### Client-Side Integration

The client-side components have been updated to handle antivirus-related errors:

1. **Error Handling**
   - The `MediaUploader` component now detects and displays virus-related errors
   - Special UI indicators show when a file has been rejected due to virus detection

2. **User Feedback**
   - Clear error messages inform users when a file has been rejected due to security concerns
   - The UI prevents users from submitting forms with infected files

## Testing

To test the antivirus functionality:

1. **EICAR Test File**
   - The EICAR test file is a standard test file that all antivirus software should detect
   - You can create an EICAR test file with the following content:
     ```
     X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*
     ```

2. **Test Script**
   - A test script is available at `/scripts/test-antivirus.js`
   - This script tests both the EICAR test file and a clean file to verify proper detection

## Troubleshooting

### Permission Issues

If you encounter permission issues with the ClamAV daemon:

1. Check that the daemon is running:
   ```
   sudo systemctl status clamav-daemon
   ```

2. Verify socket permissions:
   ```
   ls -la /var/run/clamav/
   ```

3. If needed, adjust the configuration to use `clamscan` directly by setting `USE_CLAMD=false`

### Scanning Performance

- Using the ClamAV daemon (`clamd`) is more efficient for high-volume scanning
- Direct `clamscan` usage is simpler but may be slower for large files
- Consider your deployment environment when choosing between these options

## Future Improvements

Potential future enhancements to the antivirus integration:

1. Implement quarantine functionality for infected files
2. Add periodic scanning of existing files
3. Improve performance through optimized scanning configurations
4. Add detailed logging and alerting for security incidents

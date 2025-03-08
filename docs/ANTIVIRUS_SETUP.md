# Antivirus Setup for Silkyway

This document provides instructions for setting up ClamAV antivirus scanning for file uploads in the Silkyway marketplace application.

## Overview

Silkyway now includes antivirus scanning for all uploaded files to protect against malware. The implementation uses:

- ClamAV as the antivirus engine
- The `clamscan` Node.js package to interface with ClamAV

## Installation

### 1. Install ClamAV

#### Ubuntu/Debian:
```bash
sudo apt-get update
sudo apt-get install clamav clamav-daemon
```

#### macOS (using Homebrew):
```bash
brew install clamav
```

#### Windows:
Download and install from [ClamAV's official website](https://www.clamav.net/downloads).

### 2. Update Virus Definitions

After installation, update the virus definitions:

```bash
sudo freshclam
```

### 3. Start ClamAV Daemon (clamd)

For better performance with multiple scans, it's recommended to use the ClamAV daemon:

```bash
sudo systemctl start clamav-daemon
```

To enable it to start on boot:

```bash
sudo systemctl enable clamav-daemon
```

## Configuration

The antivirus scanning functionality can be configured using the following environment variables:

```
# Path to the ClamAV executable
CLAMSCAN_PATH=/usr/bin/clamscan

# Path to the ClamAV daemon socket
CLAMD_SOCKET=/var/run/clamav/clamd.ctl

# Whether to use the ClamAV daemon (recommended for production)
USE_CLAMD=true

# For development environments, you can mock the AV scan
MOCK_AV_SCAN=false
```

Add these to your `.env` file or environment configuration.

## Development Environment

For development purposes, you can set `MOCK_AV_SCAN=true` to simulate virus scanning without having ClamAV installed. This will log the scanning process but won't perform actual scanning.

## Testing

To test the antivirus functionality, you can use the EICAR test file, which is a standard test file for antivirus software:

```
X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*
```

Save this string to a file and try to upload it. The system should detect it as a virus and prevent the upload.

## Troubleshooting

### Common Issues

1. **Socket Permission Issues**: If you encounter permission issues with the ClamAV socket, ensure your application has the necessary permissions:

   ```bash
   sudo chmod 666 /var/run/clamav/clamd.ctl
   ```

2. **Slow Scanning**: If scanning is slow, ensure you're using the daemon mode by setting `USE_CLAMD=true`.

3. **ClamAV Not Found**: Verify the path to the ClamAV executable is correct in your environment variables.

### Logs

Check the application logs for any issues related to antivirus scanning. The system logs detailed information about the scanning process and any errors encountered.

declare module 'busboy' {
  import { IncomingHttpHeaders } from 'http';
  
  interface BusboyConfig {
    headers: IncomingHttpHeaders;
    limits?: {
      fileSize?: number;
      files?: number;
      fields?: number;
    };
  }
  
  interface FileInfo {
    filename: string;
    encoding: string;
    mimeType: string;
  }
  
  interface Busboy {
    on(event: 'file', listener: (fieldname: string, stream: NodeJS.ReadableStream, info: FileInfo) => void): this;
    on(event: 'field', listener: (fieldname: string, value: string) => void): this;
    on(event: 'close', listener: () => void): this;
    on(event: 'error', listener: (error: Error) => void): this;
    on(event: string, listener: (...args: any[]) => void): this;
  }
  
  function busboy(config: BusboyConfig): Busboy;
  
  export default busboy;
}

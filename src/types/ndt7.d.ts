declare module '@anthropic-ai/sdk' {
  // Placeholder - actual types from package
}

declare module '@m-lab/ndt7' {
  interface NDT7Config {
    userAcceptedDataPolicy: boolean;
    downloadworkerfile?: string;
    uploadworkerfile?: string;
    metadata?: Record<string, string>;
  }

  interface NDT7ServerInfo {
    machine: string;
    location?: {
      city?: string;
      country?: string;
    };
    urls?: Record<string, string>;
  }

  interface NDT7MeasurementData {
    Source: 'client' | 'server';
    Data: {
      MeanClientMbps?: number;
      TCPInfo?: {
        MinRTT?: number;
        SmoothedRTT?: number;
        RTTVar?: number;
      };
      ElapsedTime?: number;
      NumBytes?: number;
    };
  }

  interface NDT7Callbacks {
    serverChosen?: (server: NDT7ServerInfo) => void;
    downloadMeasurement?: (data: NDT7MeasurementData) => void;
    downloadComplete?: (data: unknown) => void;
    uploadMeasurement?: (data: NDT7MeasurementData) => void;
    uploadComplete?: (data: unknown) => void;
    error?: (err: string | Error) => void;
  }

  const ndt7: {
    test: (config: NDT7Config, callbacks: NDT7Callbacks) => Promise<void>;
    /** One Locate call; resolves to the tokened wss URL map. Reusable across
     *  sequential download/upload runs (tokens are time-limited, not single-use). */
    discoverServerURLs: (
      config: NDT7Config,
      callbacks: NDT7Callbacks,
    ) => Promise<Record<string, string>>;
    downloadTest: (
      config: NDT7Config,
      callbacks: NDT7Callbacks,
      urlPromise: Promise<Record<string, string>>,
    ) => Promise<number>;
    uploadTest: (
      config: NDT7Config,
      callbacks: NDT7Callbacks,
      urlPromise: Promise<Record<string, string>>,
    ) => Promise<number>;
  };

  export default ndt7;
}

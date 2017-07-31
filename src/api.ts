const fetch = require('node-fetch');

export interface FileReading {
  filename: string;
  name: string;
  root: string;
  hash: string;
  rawSize: number|null;
  gzipSize: number|null;
};

export interface Reading {
  files: FileReading[];
  bundleset: string;
  commit?: string;
  branch?: string;
  isFeatureBranch?: string|boolean,
  parentCommits?: string[];
};


class ApiError extends Error {}


export default class Api {
  url: string;
  projectKey: string;

  constructor(url: string, projectKey: string) {
    this.url = url;
    this.projectKey = projectKey;
  }

  async submitReading(reading: Reading) {
    const response = await fetch(`${this.url}/reading`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authentication: this.projectKey
      },
      body: JSON.stringify(reading)
    });
    if (!response.ok) {
      let error;
      const data = await response.json();
      error = data.error;
      throw new ApiError(`API failed with status code: ${response.status}, ${error}`)
    }
    const data = await response.json();
  }
}
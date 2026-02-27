export type SearchResult = {
  title: string;
  url: string;
  creator?: string;
  thumbnail?: string;
};

export type OwnedWork = {
  id: string;
  title: string;
  detailUrl: string;
  downloadUrl?: string;
  playUrl?: string;
  thumbnail?: string;
};

export type WorkTreeEntry = {
  hashname: string;
  name: string;
  path: string;
  optimizedName?: string;
  type?: string;
  isPlayable: boolean;
  isAudio: boolean;
};

export type WorkTreeNode =
  | {
      kind: "folder";
      name: string;
      path: string;
      children: WorkTreeNode[];
    }
  | {
      kind: "file";
      name: string;
      path: string;
      entry: WorkTreeEntry;
    };

export type DownloadTask = {
  workId: string;
  title: string;
  status: "queued" | "downloading" | "done" | "failed";
  message?: string;
};

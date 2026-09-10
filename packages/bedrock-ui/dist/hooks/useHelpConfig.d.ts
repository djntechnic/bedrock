export interface HelpEntry {
    help_entry_id?: number;
    topic_key: string;
    title: string;
    body_markdown: string;
    doc_url?: string | null;
    doc_label?: string | null;
    created_at?: string;
    created_by?: string;
    modified_at?: string;
    modified_by?: string;
}
export declare function useHelpConfig(topicKey: string): {
    helpEntry: HelpEntry | null;
    isLoading: boolean;
    isError: boolean;
    refetch: () => Promise<unknown>;
};

/**
 * A curated subset of `auth_activity_service.EVENT_TYPES` — the entries
 * bedrock's own auth code writes. The rest of that frozenset (config-write
 * and grid-setting audit events, season/alias edits, admin inventory writes)
 * is app-specific and does not belong on the platform's own filter; a
 * consumer that writes those events passes them through the `eventTypes`
 * prop instead.
 *
 * `tests/test_security_event_vocabulary.py` parses this array out of this
 * file and fails if any entry here is not a member of that frozenset — so
 * this list can shrink or reorder freely, but every name in it has to stay
 * real.
 */
export declare const PLATFORM_EVENT_TYPES: readonly string[];
export interface SecurityLogViewerProps {
    /** Extra event types to offer in the filter, appended to the platform's own. */
    eventTypes?: readonly string[];
    /** Rows per page. Default 100. */
    pageSize?: number;
}
export default function SecurityLogViewer({ eventTypes, pageSize, }?: SecurityLogViewerProps): import("react").JSX.Element;

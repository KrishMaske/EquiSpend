// Shared data store between scanner and results screens.
// We store data here instead of passing through URL params
// (which can break with long data URIs).

let _imageUri: string | null = null;
let _location: { latitude: number; longitude: number; city?: string; country?: string } | null = null;

export function setSharedImage(uri: string | null) {
    _imageUri = uri;
}

export function getSharedImage(): string | null {
    return _imageUri;
}

export function setSharedLocation(loc: { latitude: number; longitude: number; city?: string; country?: string } | null) {
    _location = loc;
}

export function getSharedLocation() {
    return _location;
}

import { urlToDataUrl } from './image';
import { isDataImage, type Profile } from './profile';
import { downloadBlob } from './share';
import { buildVCard, photoFromDataUrl, vcardFileName, type VCardPhoto } from './vcard';

/** Full contact card, photo included, for "Save contact". */
export async function contactBlob(p: Profile): Promise<Blob> {
  let photo: VCardPhoto | null = null;
  if (isDataImage(p.photo)) {
    photo = photoFromDataUrl(p.photo);
  } else if (p.photo) {
    const data = await urlToDataUrl(p.photo);
    photo = (data && photoFromDataUrl(data)) || { uri: p.photo };
  }
  return new Blob([buildVCard(p, { photo })], { type: 'text/vcard;charset=utf-8' });
}

/** Pass a blob built ahead of time so the save happens inside the tap, with no network wait. */
export async function downloadContact(p: Profile, ready?: Blob | null) {
  downloadBlob(ready ?? (await contactBlob(p)), vcardFileName(p));
}

import { urlToDataUrl } from './image';
import { isDataImage, type Profile } from './profile';
import { downloadBlob } from './share';
import { buildVCard, photoFromDataUrl, vcardFileName, type VCardPhoto } from './vcard';

/** Full contact card, photo included, for "Save contact". */
async function contactBlob(p: Profile): Promise<Blob> {
  let photo: VCardPhoto | null = null;
  if (isDataImage(p.photo)) {
    photo = photoFromDataUrl(p.photo);
  } else if (p.photo) {
    const data = await urlToDataUrl(p.photo);
    photo = (data && photoFromDataUrl(data)) || { uri: p.photo };
  }
  return new Blob([buildVCard(p, { photo })], { type: 'text/vcard;charset=utf-8' });
}

export async function downloadContact(p: Profile) {
  downloadBlob(await contactBlob(p), vcardFileName(p));
}

import { GuidProvider } from '../contract/guid-provider.interface';
import { v7 } from 'uuid';
export default class UuidV7Provider implements GuidProvider {
  generate() {
    return v7();
  }
}

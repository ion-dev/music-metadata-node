import initDebug from 'debug';
import type { ITokenizer } from 'strtok3';

import type { INativeMetadataCollector } from '../common/MetadataCollector.js';
import { BasicParser } from '../common/BasicParser.js';
import { matroskaDtd } from './MatroskaDtd.js';
import { IAttachments, type IMatroskaDoc, IMatroskaSegment, ISegmentInformation, ITags, ITrackElement, type ITrackEntry, TargetType, TrackType } from './types.js';

import type { AnyTagValue, IOptions, ITrackInfo } from '../type.js';
import type { ITokenParser } from '../ParserFactory.js';
import { EbmlIterator } from '../ebml/EbmlIterator.js';

const debug = initDebug('music-metadata:parser:matroska');

/**
 * Extensible Binary Meta Language (EBML) parser
 * https://en.wikipedia.org/wiki/Extensible_Binary_Meta_Language
 * http://matroska.sourceforge.net/technical/specs/rfc/index.html
 *
 * WEBM VP8 AUDIO FILE
 */
export class MatroskaParser extends BasicParser {

  /**
   * Initialize parser with output (metadata), input (tokenizer) & parsing options (options).
   * @param {INativeMetadataCollector} metadata Output
   * @param {ITokenizer} tokenizer Input
   * @param {IOptions} options Parsing options
   */
  public init(metadata: INativeMetadataCollector, tokenizer: ITokenizer, options: IOptions): ITokenParser {
    super.init(metadata, tokenizer, options);
    return this;
  }

  public async parse(): Promise<void> {

    const containerSize = this.tokenizer.fileInfo.size ?? Number.MAX_SAFE_INTEGER;

    const matroskaIterator = new EbmlIterator(this.tokenizer);
    debug('Initializing DTD end MatroskaIterator');
    const matroska = await matroskaIterator.iterate(matroskaDtd, containerSize, async (element, value) => {
      debug(`Received: name=${element.name}, value=${value}`);
      switch (element.id) {
        case 0x4282: // docType
          this.metadata.setFormat('container', `EBML/${value}`);
          break;

        case 0x1549a966: {// info
          const info = value as ISegmentInformation;
          const timecodeScale = info.timecodeScale ? info.timecodeScale : 1000000;
          if (typeof info.duration === 'number') {
            const duration = info.duration * timecodeScale / 1000000000;
            await this.addTag('segment:title', info.title);
            this.metadata.setFormat('duration', Number(duration));
          }
        }
          break;

        case 0x1654ae6b: { // tracks
          const audioTracks = value as ITrackElement;
          if (audioTracks?.entries) {
            audioTracks.entries.forEach(entry => {
              const stream: ITrackInfo = {
                codecName: entry.codecID.replace('A_', '').replace('V_', ''),
                codecSettings: entry.codecSettings,
                flagDefault: entry.flagDefault,
                flagLacing: entry.flagLacing,
                flagEnabled: entry.flagEnabled,
                language: entry.language,
                name: entry.name,
                type: entry.trackType,
                audio: entry.audio,
                video: entry.video
              };
              this.metadata.addStreamInfo(stream);
            });

            const audioTrack = audioTracks.entries
              .filter(entry => entry.trackType === TrackType.audio)
              .reduce((acc: ITrackEntry | null, cur: ITrackEntry): ITrackEntry => {
                if (!acc) return cur;
                if (cur.flagDefault && !acc.flagDefault) return cur;
                if (cur.trackNumber < acc.trackNumber) return cur;
                return acc;
              }, null);

            if (audioTrack) {
              this.metadata.setFormat('codec', audioTrack.codecID.replace('A_', ''));
              this.metadata.setFormat('sampleRate', audioTrack.audio.samplingFrequency);
              this.metadata.setFormat('numberOfChannels', audioTrack.audio.channels);
            }
          }
        }
          break;

        case 0x1254c367: { // 'tags'
          const tags = value as unknown as ITags;
          await Promise.all(tags.tag.map(async tag => {
            const target = tag.target;
            const targetType = target?.targetTypeValue ? TargetType[target.targetTypeValue] : (target?.targetType ? target.targetType : 'track');
            await Promise.all(tag.simpleTags.map(async simpleTag => {
              const value = simpleTag.string ? simpleTag.string : simpleTag.binary;
              await this.addTag(`${targetType}:${simpleTag.name}`, value);
            }));
          }));
        }
          break;

        case 0x1941a469: { //attachments
          const attachments = value as unknown as IAttachments;
          await Promise.all(attachments.attachedFiles
            .filter(file => file.mimeType.startsWith('image/'))
            .map(file => this.addTag('picture', {
              data: file.data,
              format: file.mimeType,
              description: file.description,
              name: file.name
            })));

        }
          break;

        //case 'cluster':
        case 0x18538067: // segment
          debug(`Cancel EBML parser after element ${element.name}`);
          return true; // Quite EBML parser, we got the metadata we need
      }
      return false;
    }) as unknown as IMatroskaDoc;
  }

  private async addTag(tagId: string, value: AnyTagValue): Promise<void> {
    await this.metadata.addTag('matroska', tagId, value);
  }

}

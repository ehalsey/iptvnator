import {
    Component,
    ElementRef,
    Input,
    OnChanges,
    OnDestroy,
    OnInit,
    SimpleChanges,
} from '@angular/core';
import Artplayer from 'artplayer';
import Hls from 'hls.js';
import { Channel } from '../../../../../shared/channel.interface';

Artplayer.AUTO_PLAYBACK_TIMEOUT = 10000;

@Component({
    selector: 'app-art-player',
    imports: [],
    template: `<div #artplayer class="artplayer-container"></div>`,
    styles: [
        `
            :host {
                display: block;
                width: 100%;
                height: 100%;
            }
            .artplayer-container {
                width: 100%;
                height: 100%;
            }
        `,
    ],
})
export class ArtPlayerComponent implements OnInit, OnDestroy, OnChanges {
    @Input() channel: Channel;
    @Input() volume = 1;
    @Input() showCaptions = false;

    private player: Artplayer;

    constructor(private elementRef: ElementRef) {}

    ngOnInit(): void {
        this.initPlayer();
    }

    ngOnDestroy(): void {
        if (this.player) {
            this.player.destroy();
        }
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['channel'] && !changes['channel'].firstChange) {
            if (this.player) {
                this.player.destroy();
            }
            this.initPlayer();
        }
    }

    private initPlayer(): void {
        console.log('[ART-PLAYER] Initializing ArtPlayer with channel:', this.channel);
        const el = this.elementRef.nativeElement.querySelector(
            '.artplayer-container'
        );
        const isLive = this.channel?.url?.toLowerCase().includes('m3u8');
        const videoType = this.getVideoType(this.channel.url);
        const videoUrl = this.channel.url + (this.channel.epgParams || '');

        console.log('[ART-PLAYER] Video URL:', videoUrl);
        console.log('[ART-PLAYER] Video type:', videoType);
        console.log('[ART-PLAYER] Is live:', isLive);

        this.player = new Artplayer({
            container: el,
            url: videoUrl,
            volume: this.volume,
            isLive: isLive,
            autoplay: true,
            type: videoType,
            pip: true,
            autoPlayback: true,
            autoSize: true,
            autoMini: true,
            screenshot: true,
            setting: true,
            playbackRate: true,
            aspectRatio: true,
            fullscreen: true,
            fullscreenWeb: true,
            playsInline: true,
            airplay: true,
            backdrop: true,
            mutex: true,
            theme: '#ff0000',
            customType: {
                m3u8: function (video: HTMLVideoElement, url: string) {
                    console.log('[ART-PLAYER] Loading M3U8:', url);
                    if (Hls.isSupported()) {
                        console.log('[ART-PLAYER] HLS.js is supported, using HLS.js');
                        const hls = new Hls();
                        hls.loadSource(url);
                        hls.attachMedia(video);
                        hls.on(Hls.Events.ERROR, (event, data) => {
                            console.error('[ART-PLAYER] HLS error:', event, data);
                        });
                    } else if (
                        video.canPlayType('application/vnd.apple.mpegurl')
                    ) {
                        console.log('[ART-PLAYER] Using native HLS support');
                        video.src = url;
                    } else {
                        console.error('[ART-PLAYER] HLS not supported');
                    }
                },
                mkv: function (video: HTMLVideoElement, url: string) {
                    console.log('[ART-PLAYER] Loading MKV:', url);
                    video.src = url;
                    // Add error handling
                    video.onerror = () => {
                        console.error('[ART-PLAYER] Error loading MKV file:', video.error);
                        // Fallback to treating it as a regular video
                        video.src = url;
                    };
                },
            },
        });

        this.player.on('ready', () => {
            console.log('[ART-PLAYER] Player ready');
        });

        this.player.on('video:canplay', () => {
            console.log('[ART-PLAYER] Video can play');
        });

        this.player.on('video:playing', () => {
            console.log('[ART-PLAYER] Video playing');
        });

        this.player.on('video:error', (error) => {
            console.error('[ART-PLAYER] Video error:', error);
        });

        console.log('[ART-PLAYER] Player initialization complete');
    }

    private getVideoType(url: string): string {
        const extension = url.split('.').pop()?.toLowerCase();
        switch (extension) {
            case 'mkv':
                return 'video/matroska'; // Changed from 'mkv'
            case 'm3u8':
                return 'm3u8';
            case 'mp4':
                return 'mp4';
            default:
                return 'auto';
        }
    }
}

import { Injectable, inject, NgZone } from '@angular/core';
import { Location } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';

/** CSS selectors for left sidebar across all layouts */
const SIDEBAR_SELECTORS = '.app-rail, .navigation-sidebar';
/** Focusable links inside any sidebar */
const SIDEBAR_LINK_SELECTORS =
    'a[mat-list-item], a.portal-rail-link, a.brand, a.rail-shortcut';
/** Header bar selector */
const HEADER_SELECTOR = '.workspace-header';
/** Focusable items in the header */
const HEADER_FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled])';
/** All focusable elements in content grids */
const CONTENT_FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]), ' +
    '[tabindex]:not([tabindex="-1"]), mat-card';

/**
 * Handles Android TV / Fire Stick remote navigation:
 * - Back button: close overlays or navigate back instead of exiting
 * - D-pad arrows: move focus between sidebar and content area
 */
@Injectable({ providedIn: 'root' })
export class TvNavigationService {
    private readonly router = inject(Router);
    private readonly location = inject(Location);
    private readonly ngZone = inject(NgZone);
    private readonly dialog = inject(MatDialog);

    private initialized = false;
    private readonly isCapacitor =
        !!(window as any).Capacitor?.isNativePlatform?.();

    /**
     * Enable TV mode automatically on Capacitor, or manually via
     * ?tv=1 query parameter or localStorage flag for browser testing.
     */
    initialize(): void {
        if (this.initialized) return;

        const forceTV =
            new URLSearchParams(window.location.search).has('tv') ||
            localStorage.getItem('tv-mode') === '1';

        if (!this.isCapacitor && !forceTV) return;
        this.initialized = true;

        if (forceTV) {
            localStorage.setItem('tv-mode', '1');
            console.log('TV mode enabled (browser). Disable with: localStorage.removeItem("tv-mode")');
        }

        if (this.isCapacitor) {
            this.setupBackButton();
        } else {
            this.setupBrowserBackButton();
        }
        this.setupDpadNavigation();
        document.body.classList.add('tv-mode');
    }

    private async setupBackButton(): Promise<void> {
        try {
            const { App } = await import('@capacitor/app');
            App.addListener('backButton', () => {
                this.ngZone.run(() => {
                    // 1. Close any open mat-menu by clicking its backdrop
                    const menuBackdrop = document.querySelector(
                        '.cdk-overlay-backdrop.cdk-overlay-transparent-backdrop'
                    ) as HTMLElement;
                    if (menuBackdrop) {
                        menuBackdrop.click();
                        return;
                    }

                    // 2. Close any open mat-dialog
                    if (this.dialog.openDialogs.length > 0) {
                        this.dialog.openDialogs[
                            this.dialog.openDialogs.length - 1
                        ].close();
                        return;
                    }

                    // 3. Close any other CDK overlay (snackbar, etc.)
                    const anyBackdrop = document.querySelector(
                        '.cdk-overlay-backdrop'
                    ) as HTMLElement;
                    if (anyBackdrop) {
                        anyBackdrop.click();
                        return;
                    }

                    // 4. Navigate back, or minimize at root
                    if (
                        this.router.url === '/' ||
                        this.router.url === '/workspace/dashboard' ||
                        this.router.url === '/workspace'
                    ) {
                        App.minimizeApp();
                    } else {
                        this.location.back();
                    }
                });
            });
        } catch (err) {
            console.warn('Capacitor App plugin not available:', err);
        }
    }

    /** In browser TV mode, Escape simulates the Fire Stick back button */
    private setupBrowserBackButton(): void {
        document.addEventListener('keydown', (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;

            // Let Angular Material handle Escape for its own overlays first
            const menuBackdrop = document.querySelector(
                '.cdk-overlay-backdrop.cdk-overlay-transparent-backdrop'
            ) as HTMLElement;
            if (menuBackdrop) return; // mat-menu handles its own Escape

            if (this.dialog.openDialogs.length > 0) return; // dialog handles its own Escape

            // No overlay open - simulate back navigation
            event.preventDefault();
            if (
                this.router.url === '/' ||
                this.router.url === '/workspace/dashboard' ||
                this.router.url === '/workspace'
            ) {
                console.log('TV back: at root, would minimize on Fire Stick');
            } else {
                this.location.back();
            }
        });
    }

    private setupDpadNavigation(): void {
        document.addEventListener('keydown', (event: KeyboardEvent) => {
            // Don't interfere with overlays/menus
            if (document.querySelector('.cdk-overlay-backdrop')) return;

            switch (event.key) {
                case 'ArrowLeft':
                    this.handleLeftArrow(event);
                    break;
                case 'ArrowRight':
                    this.handleRightArrow(event);
                    break;
                case 'ArrowUp':
                    this.handleVerticalArrow(event, -1);
                    break;
                case 'ArrowDown':
                    this.handleVerticalArrow(event, 1);
                    break;
            }
        });
    }

    /** Find the visible sidebar element */
    private findSidebar(): Element | null {
        return document.querySelector(SIDEBAR_SELECTORS);
    }

    /** Get all focusable links in the sidebar */
    private getSidebarLinks(sidebar: Element): HTMLElement[] {
        return Array.from(
            sidebar.querySelectorAll(SIDEBAR_LINK_SELECTORS)
        ) as HTMLElement[];
    }

    /** ArrowLeft: move focus into sidebar, navigate grid, or header items */
    private handleLeftArrow(event: KeyboardEvent): void {
        if (this.isInputElement(event.target)) return;

        // Try grid navigation first (move to previous card in grid)
        if (this.handleGridNavigation(event, 'left')) return;

        const header = document.querySelector(HEADER_SELECTOR);

        // Navigate between header items with Left arrow
        if (header?.contains(document.activeElement)) {
            const items = Array.from(
                header.querySelectorAll(HEADER_FOCUSABLE)
            ) as HTMLElement[];
            const idx = items.indexOf(document.activeElement as HTMLElement);
            if (idx > 0) {
                event.preventDefault();
                items[idx - 1].focus();
                return;
            }
            // At leftmost header item → go to sidebar
            const sidebar = this.findSidebar();
            if (sidebar) {
                event.preventDefault();
                this.focusSidebarLink(sidebar);
            }
            return;
        }

        const sidebar = this.findSidebar();
        if (!sidebar) return;

        if (!sidebar.contains(document.activeElement)) {
            event.preventDefault();
            this.focusSidebarLink(sidebar);
        }
    }

    /** ArrowRight: move from sidebar to content, grid nav, or header items */
    private handleRightArrow(event: KeyboardEvent): void {
        if (this.isInputElement(event.target)) return;

        // Try grid navigation first (move to next card in grid)
        if (this.handleGridNavigation(event, 'right')) return;

        const header = document.querySelector(HEADER_SELECTOR);

        // Navigate between header items with Right arrow
        if (header?.contains(document.activeElement)) {
            const items = Array.from(
                header.querySelectorAll(HEADER_FOCUSABLE)
            ) as HTMLElement[];
            const idx = items.indexOf(document.activeElement as HTMLElement);
            if (idx >= 0 && idx < items.length - 1) {
                event.preventDefault();
                items[idx + 1].focus();
            }
            return;
        }

        const sidebar = this.findSidebar();
        if (!sidebar) return;

        if (sidebar.contains(document.activeElement)) {
            event.preventDefault();
            this.focusContentArea();
        }
    }

    /** ArrowUp/Down: navigate sidebar, header, content, and grid areas */
    private handleVerticalArrow(
        event: KeyboardEvent,
        direction: number
    ): void {
        const isInput = this.isInputElement(event.target);

        // Allow ArrowDown from input to escape to content below
        if (isInput && direction === 1) {
            event.preventDefault();
            this.focusNextContentBelow(event.target as HTMLElement);
            return;
        }

        // Allow ArrowUp from input to move to previous focusable element
        if (isInput && direction === -1) {
            event.preventDefault();
            this.focusPrevContentAbove(event.target as HTMLElement);
            return;
        }

        if (isInput) return;

        // Try grid navigation (move up/down rows in a grid)
        if (this.handleGridNavigation(event, direction === -1 ? 'up' : 'down')) {
            return;
        }

        const header = document.querySelector(HEADER_SELECTOR);
        const sidebar = this.findSidebar();

        // --- Focus is in the header ---
        if (header?.contains(document.activeElement)) {
            const headerItems = Array.from(
                header.querySelectorAll(HEADER_FOCUSABLE)
            ) as HTMLElement[];
            const idx = headerItems.indexOf(
                document.activeElement as HTMLElement
            );

            if (direction === 1) {
                // ArrowDown from header → go to content area
                event.preventDefault();
                this.focusContentArea();
                return;
            }

            // ArrowUp within header (move between header items)
            if (idx > 0) {
                event.preventDefault();
                headerItems[idx - 1].focus();
            }
            return;
        }

        // --- Focus is in sidebar ---
        if (sidebar?.contains(document.activeElement)) {
            const links = this.getSidebarLinks(sidebar);
            const currentIndex = links.indexOf(
                document.activeElement as HTMLElement
            );
            if (currentIndex === -1) return;

            const nextIndex = currentIndex + direction;

            // ArrowUp at top of sidebar → move to header
            if (nextIndex < 0 && header) {
                event.preventDefault();
                const headerItems = Array.from(
                    header.querySelectorAll(HEADER_FOCUSABLE)
                ) as HTMLElement[];
                if (headerItems.length > 0) {
                    headerItems[0].focus();
                }
                return;
            }

            if (nextIndex >= 0 && nextIndex < links.length) {
                event.preventDefault();
                links[nextIndex].focus();
            }
            return;
        }

        // --- Focus is elsewhere (content area) ---
        // ArrowUp from content → try header
        if (direction === -1 && header) {
            event.preventDefault();
            const headerItems = Array.from(
                header.querySelectorAll(HEADER_FOCUSABLE)
            ) as HTMLElement[];
            if (headerItems.length > 0) {
                headerItems[0].focus();
            }
        }
    }

    /**
     * Handle grid-based navigation (results grids, card grids).
     * Returns true if navigation was handled.
     */
    private handleGridNavigation(
        event: KeyboardEvent,
        direction: 'left' | 'right' | 'up' | 'down'
    ): boolean {
        const active = document.activeElement as HTMLElement;
        if (!active) return false;

        // Find the grid container this element belongs to
        const grid = active.closest(
            '.results-grid, .grid'
        ) as HTMLElement;
        if (!grid) return false;

        const items = Array.from(
            grid.querySelectorAll(CONTENT_FOCUSABLE)
        ) as HTMLElement[];
        const idx = items.indexOf(active);
        if (idx === -1) return false;

        // Calculate columns from grid layout
        const cols = this.getGridColumns(grid, items);

        let targetIdx = -1;
        switch (direction) {
            case 'left':
                targetIdx = idx - 1;
                break;
            case 'right':
                targetIdx = idx + 1;
                break;
            case 'up':
                targetIdx = idx - cols;
                break;
            case 'down':
                targetIdx = idx + cols;
                break;
        }

        if (targetIdx >= 0 && targetIdx < items.length) {
            event.preventDefault();
            items[targetIdx].focus();
            items[targetIdx].scrollIntoView({ block: 'nearest' });
            return true;
        }

        return false;
    }

    /** Estimate number of columns in a CSS grid by comparing element positions */
    private getGridColumns(grid: HTMLElement, items: HTMLElement[]): number {
        if (items.length < 2) return 1;
        const firstTop = items[0].getBoundingClientRect().top;
        for (let i = 1; i < items.length; i++) {
            if (items[i].getBoundingClientRect().top !== firstTop) {
                return i;
            }
        }
        return items.length; // single row
    }

    /**
     * Focus the next focusable element after the given element in DOM order.
     * This enables ArrowDown from an input to reach checkboxes, buttons,
     * and result cards below it.
     */
    private focusNextContentBelow(fromElement: HTMLElement): void {
        // Get all focusable elements on the page in DOM order
        const allFocusable = Array.from(
            document.querySelectorAll(
                'a[href], button:not([disabled]), input:not([disabled]), ' +
                'select:not([disabled]), textarea:not([disabled]), ' +
                '[tabindex]:not([tabindex="-1"]), mat-card[tabindex]'
            )
        ) as HTMLElement[];

        const currentIdx = allFocusable.indexOf(fromElement);
        if (currentIdx === -1 || currentIdx >= allFocusable.length - 1) return;

        // Focus the next element after the current one
        const next = allFocusable[currentIdx + 1];
        if (next) {
            next.focus();
            next.scrollIntoView({ block: 'nearest' });
        }
    }

    /**
     * Focus the previous focusable element before the given element in DOM order.
     */
    private focusPrevContentAbove(fromElement: HTMLElement): void {
        const allFocusable = Array.from(
            document.querySelectorAll(
                'a[href], button:not([disabled]), input:not([disabled]), ' +
                'select:not([disabled]), textarea:not([disabled]), ' +
                '[tabindex]:not([tabindex="-1"]), mat-card[tabindex]'
            )
        ) as HTMLElement[];

        const currentIdx = allFocusable.indexOf(fromElement);
        if (currentIdx <= 0) return;

        const prev = allFocusable[currentIdx - 1];
        if (prev) {
            prev.focus();
            prev.scrollIntoView({ block: 'nearest' });
        }
    }

    /** Focus the active sidebar link, or the first link */
    private focusSidebarLink(sidebar: Element): void {
        const activeLink = sidebar.querySelector(
            'a.active, a.is-active'
        ) as HTMLElement;
        if (activeLink) {
            activeLink.focus();
            return;
        }
        const links = this.getSidebarLinks(sidebar);
        if (links.length > 0) {
            links[0].focus();
        }
    }

    /** Move focus to the first focusable element in the content area */
    private focusContentArea(): void {
        // Try workspace content first, then router-outlet siblings
        const contentAreas = [
            document.querySelector('.workspace-content'),
            document.querySelector('.results-container'),
            document.querySelector('.search-content'),
            ...Array.from(document.querySelectorAll('router-outlet')).map(
                (o) => o.nextElementSibling
            ),
        ].filter(Boolean) as HTMLElement[];

        for (const area of contentAreas) {
            const focusable = area.querySelector(
                CONTENT_FOCUSABLE
            ) as HTMLElement;
            if (focusable) {
                focusable.focus();
                return;
            }
        }
    }

    private isInputElement(target: EventTarget | null): boolean {
        if (!target) return false;
        const tag = (target as HTMLElement).tagName;
        return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    }
}

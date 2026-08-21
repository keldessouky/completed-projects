/*  ARM7 core.
 *
 *  The DS's little processor does none of the game: it reads the buttons and
 *  the touch screen, feeds the sound hardware, and answers the ARM9 over the
 *  FIFO. libnds already implements all of that; this is the wiring.
 */
#include <nds.h>

static volatile bool exit_requested = false;

static void vcount_handler(void) { inputGetAndSend(); }
static void vblank_handler(void) {}
static void power_button(void) { exit_requested = true; }

int main(void) {
    readUserSettings();
    ledBlink(0);

    irqInit();
    fifoInit();

    installSystemFIFO();   /* power, sleep, storage requests from the ARM9 */
    installSoundFIFO();    /* soundPlaySample / soundPlayPSG from the ARM9  */

    SetYtrigger(80);
    irqSet(IRQ_VCOUNT, vcount_handler);
    irqSet(IRQ_VBLANK, vblank_handler);
    irqEnable(IRQ_VBLANK | IRQ_VCOUNT | IRQ_NETWORK);

    setPowerButtonCB(power_button);

    while (!exit_requested) {
        swiWaitForVBlank();
    }
    return 0;
}

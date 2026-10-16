import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import crypto from 'node:crypto';

const execFileAsync = promisify(execFile);
const MAX_OUTPUT_BYTES = Number(process.env.MAX_OUTPUT_BYTES ?? 1_000_000);

export type ScreenInfo = {
  index: number;
  deviceName: string;
  x: number;
  y: number;
  width: number;
  height: number;
  primary: boolean;
};

export async function getScreenInfo(): Promise<{ platform: string; screens: ScreenInfo[] }> {
  if (process.platform === 'win32') {
    const script = "Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class DpiAwareness { [DllImport(\"shcore.dll\")] public static extern int SetProcessDpiAwareness(int awareness); }'; try { [void][DpiAwareness]::SetProcessDpiAwareness(2) } catch {}; Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Screen]::AllScreens | ForEach-Object { $b=$_.Bounds; [PSCustomObject]@{ deviceName=$_.DeviceName; x=$b.X; y=$b.Y; width=$b.Width; height=$b.Height; primary=$_.Primary } } | ConvertTo-Json -Compress";
    const { stdout } = await execFileAsync('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, timeout: 15000, maxBuffer: MAX_OUTPUT_BYTES });
    const parsed = JSON.parse(stdout.trim() || '[]');
    const screens = (Array.isArray(parsed) ? parsed : [parsed]).map((s: any, index: number) => ({
      index, deviceName: String(s.deviceName), x: Number(s.x), y: Number(s.y),
      width: Number(s.width), height: Number(s.height), primary: Boolean(s.primary),
    }));
    return { platform: process.platform, screens };
  }
  if (process.platform === 'linux') {
    const { stdout } = await execFileAsync('xrandr', ['--listmonitors'], { timeout: 10000, maxBuffer: MAX_OUTPUT_BYTES });
    const screens = stdout.split(/\r?\n/u).slice(1).filter(Boolean).map((line, index) => {
      const match = line.match(/(\d+)\/\d+x(\d+)\/\d+\+(-?\d+)\+(-?\d+)/u);
      if (!match) return null;
      return {
        index,
        deviceName: line.trim().split(/\s+/u).slice(1).join(' ').replace(/^\+?\*?/u, ''),
        x: Number(match[3]), y: Number(match[4]), width: Number(match[1]), height: Number(match[2]),
        primary: line.includes('*'),
      };
    }).filter((screen): screen is NonNullable<typeof screen> => screen !== null);
    return { platform: process.platform, screens };
  }
  throw new Error('Screen capture is supported on Windows and Linux/X11 only.');
}

function integerArg(args: Record<string, unknown>, name: string): number {
  const value = args[name];
  if (typeof value !== 'number' || !Number.isInteger(value)) throw new Error(`${name} must be an integer`);
  return value;
}

function jpegPowerShellScript(x: number, y: number, width: number, height: number) {
  return "$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.Drawing; " +
    "$bmp=New-Object System.Drawing.Bitmap(" + width + "," + height + "); " +
    "$g=[System.Drawing.Graphics]::FromImage($bmp); $g.CopyFromScreen(" + x + "," + y + ",0,0,$bmp.Size); " +
    "$scale=[Math]::Min(1.0,[Math]::Min(1000.0/" + width + ",1000.0/" + height + ")); " +
    "$outW=[Math]::Max(1,[Math]::Round(" + width + "*$scale)); $outH=[Math]::Max(1,[Math]::Round(" + height + "*$scale)); " +
    "$outBmp=New-Object System.Drawing.Bitmap($outW,$outH); $outG=[System.Drawing.Graphics]::FromImage($outBmp); " +
    "$outG.DrawImage($bmp,0,0,$outW,$outH); $ms=New-Object System.IO.MemoryStream; " +
    "$outBmp.Save($ms,[System.Drawing.Imaging.ImageFormat]::Jpeg); [Console]::Write([Convert]::ToBase64String($ms.ToArray())); " +
    "$ms.Dispose(); $outG.Dispose(); $outBmp.Dispose(); $g.Dispose(); $bmp.Dispose()";
}

async function captureJpeg(x: number, y: number, width: number, height: number, minX: number, minY: number) {
  if (process.platform === 'win32') {
    const script = jpegPowerShellScript(x, y, width, height);
    const { stdout } = await execFileAsync('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script], {
      windowsHide: true, timeout: 30000, maxBuffer: Math.max(MAX_OUTPUT_BYTES, 100_000_000),
    });
    return stdout.trim();
  }
  if (process.platform === 'linux') {
    const { stdout } = await execFileAsync('import', [
      '-window', 'root', '-crop', `${width}x${height}+${x - minX}+${y - minY}`,
      '+repage', '-resize', '1000x1000>', '-quality', '82', 'jpeg:-',
    ], { encoding: 'buffer', timeout: 30000, maxBuffer: Math.max(MAX_OUTPUT_BYTES, 20_000_000) }) as any;
    return Buffer.from(stdout).toString('base64');
  }
  throw new Error('Screen capture is supported on Windows and Linux/X11 only.');
}

function validateJpeg(data: string, screenIndex: number) {
  if (!data || !/^[A-Za-z0-9+/]+={0,2}$/u.test(data)) throw new Error(`Screenshot capture returned invalid JPEG base64 for display ${screenIndex}`);
  const bytes = Buffer.from(data, 'base64');
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9) {
    throw new Error(`Screenshot JPEG integrity check failed for display ${screenIndex}`);
  }
  return bytes;
}

export async function takeScreenshot(args: Record<string, unknown>) {
  const info = await getScreenInfo();
  const hasCrop = ['x', 'y', 'width', 'height'].some(key => args[key] !== undefined);
  if (hasCrop && (args.screenIndex === undefined || !['x', 'y', 'width', 'height'].every(key => args[key] !== undefined))) {
    throw new Error('A cropped screenshot requires screenIndex plus all four values: x, y, width, height.');
  }
  const wanted = args.screenIndex === undefined ? info.screens : info.screens.filter(screen => screen.index === Number(args.screenIndex));
  if (!wanted.length) throw new Error(`No display found for screenIndex=${String(args.screenIndex)}`);
  if (hasCrop && wanted.length !== 1) throw new Error('A cropped screenshot must target exactly one display.');
  const minX = Math.min(...info.screens.map(screen => screen.x));
  const minY = Math.min(...info.screens.map(screen => screen.y));
  const screens = [];
  for (const screen of wanted) {
    const cropX = hasCrop ? integerArg(args, 'x') : 0;
    const cropY = hasCrop ? integerArg(args, 'y') : 0;
    const captureWidth = hasCrop ? integerArg(args, 'width') : screen.width;
    const captureHeight = hasCrop ? integerArg(args, 'height') : screen.height;
    if (cropX < 0 || cropY < 0 || captureWidth < 1 || captureHeight < 1 || cropX + captureWidth > screen.width || cropY + captureHeight > screen.height) {
      throw new Error(`Screenshot crop is outside display ${screen.index}; display size is ${screen.width}x${screen.height}.`);
    }
    const captureX = screen.x + cropX;
    const captureY = screen.y + cropY;
    const data = await captureJpeg(captureX, captureY, captureWidth, captureHeight, minX, minY);
    const imageBytes = validateJpeg(data, screen.index);
    const scale = Math.min(1, 1000 / captureWidth, 1000 / captureHeight);
    const outputWidth = Math.max(1, Math.round(captureWidth * scale));
    const outputHeight = Math.max(1, Math.round(captureHeight * scale));
    const dataSha256 = crypto.createHash('sha256').update(imageBytes).digest('hex');
    screens.push({
      ...screen, x: captureX, y: captureY, width: outputWidth, height: outputHeight,
      captureX: cropX, captureY: cropY, captureWidth, captureHeight,
      mimeType: 'image/jpeg', data, dataBytes: imageBytes.length, dataSha256,
    });
  }
  return { screens };
}
export async function getScreenPixel(args: Record<string, unknown>) {
  const info = await getScreenInfo();
  const screenIndex = integerArg(args, 'screenIndex');
  const screen = info.screens.find(candidate => candidate.index === screenIndex);
  if (!screen) throw new Error(`No display found for screenIndex=${String(args.screenIndex)}`);
  const x = integerArg(args, 'x');
  const y = integerArg(args, 'y');
  if (x < 0 || y < 0 || x >= screen.width || y >= screen.height) {
    throw new Error(`Pixel coordinates must be within display ${screen.index} bounds: x=0..${screen.width - 1}, y=0..${screen.height - 1}`);
  }
  const absoluteX = screen.x + x;
  const absoluteY = screen.y + y;
  let rgb: { r: number; g: number; b: number };
  if (process.platform === 'win32') {
    const script = "Add-Type -AssemblyName System.Drawing; $bmp = New-Object System.Drawing.Bitmap(1,1); $g = [System.Drawing.Graphics]::FromImage($bmp); $g.CopyFromScreen(" + absoluteX + "," + absoluteY + ",0,0,[System.Drawing.Size]::new(1,1)); $c = $bmp.GetPixel(0,0); [PSCustomObject]@{r=$c.R;g=$c.G;b=$c.B} | ConvertTo-Json -Compress; $g.Dispose(); $bmp.Dispose()";
    const { stdout } = await execFileAsync('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, timeout: 15000, maxBuffer: MAX_OUTPUT_BYTES });
    const pixel = JSON.parse(stdout.trim());
    rgb = { r: Number(pixel.r), g: Number(pixel.g), b: Number(pixel.b) };
  } else if (process.platform === 'linux') {
    const minX = Math.min(...info.screens.map(candidate => candidate.x));
    const minY = Math.min(...info.screens.map(candidate => candidate.y));
    const { stdout } = await execFileAsync('import', ['-window', 'root', '-crop', `1x1+${absoluteX - minX}+${absoluteY - minY}`, '+repage', 'txt:-'], { encoding: 'utf8', timeout: 15000, maxBuffer: MAX_OUTPUT_BYTES });
    const match = stdout.match(/#([0-9A-Fa-f]{6})/u);
    if (!match) throw new Error(`Unable to parse pixel color from ImageMagick: ${stdout.trim().slice(0, 200)}`);
    rgb = { r: parseInt(match[1].slice(0, 2), 16), g: parseInt(match[1].slice(2, 4), 16), b: parseInt(match[1].slice(4, 6), 16) };
  } else {
    throw new Error('Screen pixel probing is supported on Windows and Linux/X11 only.');
  }
  const hex = '#' + [rgb.r, rgb.g, rgb.b].map(value => value.toString(16).padStart(2, '0')).join('').toUpperCase();
  return {
    screenIndex: screen.index, deviceName: screen.deviceName, x, y, absoluteX, absoluteY,
    ...rgb, hex, format: 'RGB 8-bit/channel',
    note: 'Coordinates x/y are relative to the selected display; absoluteX/absoluteY are virtual-desktop coordinates.',
  };
}


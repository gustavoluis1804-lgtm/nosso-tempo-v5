import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const androidRoot = path.join(root, "android");
if (!fs.existsSync(androidRoot)) {
  console.error("❌ Pasta android não encontrada. Execute npx cap add android.");
  process.exit(1);
}

const appId = "com.gustavo.nossotempo";
const packagePath = appId.split(".").join(path.sep);
const javaDir = path.join(androidRoot, "app", "src", "main", "java", packagePath);
fs.mkdirSync(javaDir, { recursive: true });

const writeJava = (name, content) =>
  fs.writeFileSync(path.join(javaDir, name), content, "utf8");

writeJava("MainActivity.java", `package ${appId};

import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private void enterImmersiveMode() {
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
        );
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NossoTempoPlugin.class);
        super.onCreate(savedInstanceState);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        } else {
            getWindow().addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                    | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
            );
        }

        enterImmersiveMode();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) enterImmersiveMode();
    }

    @Override
    public void onResume() {
        super.onResume();
        enterImmersiveMode();
    }
}
`);

writeJava("NossoTempoPrefs.java", `package ${appId};

import android.content.Context;
import android.content.SharedPreferences;

public final class NossoTempoPrefs {
    public static final String PREFS = "nosso_tempo_v2";
    public static final long DEFAULT_START = 1789242180000L;

    private NossoTempoPrefs() {}

    public static SharedPreferences get(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public static long start(Context c) { return get(c).getLong("startTime", DEFAULT_START); }
    public static String theme(Context c) { return get(c).getString("theme", "glass"); }
    public static String accent(Context c) { return get(c).getString("accent", "#DDE3FF"); }
    public static int cardY(Context c) { return get(c).getInt("cardY", 44); }
    public static int cardScale(Context c) { return get(c).getInt("cardScale", 100); }
    public static int cardAlpha(Context c) { return get(c).getInt("cardAlpha", 22); }
    public static boolean showSeconds(Context c) { return get(c).getBoolean("showSeconds", true); }
    public static boolean showSince(Context c) { return get(c).getBoolean("showSince", true); }
    public static boolean showMilestone(Context c) { return get(c).getBoolean("showMilestone", true); }
    public static String heart(Context c) { return get(c).getString("heart", "outline"); }
    public static boolean notifications(Context c) { return get(c).getBoolean("notifications", false); }
}
`);

writeJava("MilestoneUtils.java", `package ${appId};

import java.util.ArrayList;
import java.util.Calendar;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;

public final class MilestoneUtils {

    public static class Milestone {
        public final long at;
        public final String label;

        public Milestone(long at, String label) {
            this.at = at;
            this.label = label;
        }
    }

    private MilestoneUtils() {}

    public static Milestone next(long start, long now) {
        List<Milestone> list = new ArrayList<>();

        int[] days = {10,30,50,100,200,365,500,730,1000,1500,2000};
        for (int d : days) {
            String label = d == 365 ? "1 ano" : (d == 730 ? "2 anos" : d + " dias");
            list.add(new Milestone(start + d * 86400000L, label));
        }

        for (int months = 1; months <= 60; months++) {
            Calendar cal = Calendar.getInstance();
            cal.setTimeInMillis(start);
            cal.add(Calendar.MONTH, months);

            String label;
            if (months % 12 == 0) {
                int years = months / 12;
                label = years + (years == 1 ? " ano" : " anos");
            } else {
                label = months + (months == 1 ? " mês" : " meses");
            }

            list.add(new Milestone(cal.getTimeInMillis(), label));
        }

        Collections.sort(list, Comparator.comparingLong(m -> m.at));
        for (Milestone m : list) {
            if (m.at > now) return m;
        }

        return list.get(list.size() - 1);
    }
}
`);

writeJava("MilestoneScheduler.java", `package ${appId};

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;

public final class MilestoneScheduler {

    private MilestoneScheduler() {}

    public static void schedule(Context context) {
        cancel(context);

        if (!NossoTempoPrefs.notifications(context)) return;

        long now = System.currentTimeMillis();
        MilestoneUtils.Milestone next =
            MilestoneUtils.next(NossoTempoPrefs.start(context), now);

        Intent intent = new Intent(context, MilestoneReceiver.class);
        intent.putExtra("label", next.label);

        PendingIntent pending = PendingIntent.getBroadcast(
            context,
            4401,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        AlarmManager alarm =
            (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);

        if (alarm != null) {
            alarm.setAndAllowWhileIdle(
                AlarmManager.RTC_WAKEUP,
                next.at,
                pending
            );
        }
    }

    public static void cancel(Context context) {
        Intent intent = new Intent(context, MilestoneReceiver.class);
        PendingIntent pending = PendingIntent.getBroadcast(
            context,
            4401,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        AlarmManager alarm =
            (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);

        if (alarm != null) alarm.cancel(pending);
    }
}
`);

writeJava("MilestoneReceiver.java", `package ${appId};

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import androidx.core.app.NotificationCompat;

public class MilestoneReceiver extends BroadcastReceiver {

    private static final String CHANNEL = "nosso_tempo_marcos";

    @Override
    public void onReceive(Context context, Intent intent) {
        String label = intent.getStringExtra("label");
        if (label == null) label = "um novo marco";

        NotificationManager manager =
            (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);

        if (manager == null) return;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL,
                "Marcos do Nosso Tempo",
                NotificationManager.IMPORTANCE_DEFAULT
            );
            channel.setDescription("Avisos de datas especiais do contador Nosso Tempo");
            manager.createNotificationChannel(channel);
        }

        Intent open = context.getPackageManager()
            .getLaunchIntentForPackage(context.getPackageName());

        PendingIntent contentIntent = null;
        if (open != null) {
            contentIntent = PendingIntent.getActivity(
                context,
                4402,
                open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
        }

        NotificationCompat.Builder builder =
            new NotificationCompat.Builder(context, CHANNEL)
                .setSmallIcon(android.R.drawable.btn_star_big_on)
                .setContentTitle("Nosso Tempo ♡")
                .setContentText("Hoje vocês completam " + label + " juntos.")
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT);

        if (contentIntent != null) builder.setContentIntent(contentIntent);

        manager.notify(4403, builder.build());

        MilestoneScheduler.schedule(context);
    }
}
`);

writeJava("BootReceiver.java", `package ${appId};

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        MilestoneScheduler.schedule(context);
    }
}
`);

writeJava("NossoTempoPlugin.java", `package ${appId};

import android.Manifest;
import android.app.WallpaperManager;
import android.content.ComponentName;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.hardware.biometrics.BiometricPrompt;
import android.os.Build;
import android.os.CancellationSignal;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "NossoTempo")
public class NossoTempoPlugin extends Plugin {

    @PluginMethod
    public void getSettings(PluginCall call) {
        SharedPreferences p = NossoTempoPrefs.get(getContext());
        JSObject out = new JSObject();

        out.put("startTime", p.getLong("startTime", NossoTempoPrefs.DEFAULT_START));
        out.put("theme", p.getString("theme", "glass"));
        out.put("accent", p.getString("accent", "#DDE3FF"));
        out.put("cardY", p.getInt("cardY", 44));
        out.put("cardScale", p.getInt("cardScale", 100));
        out.put("cardAlpha", p.getInt("cardAlpha", 22));
        out.put("showSeconds", p.getBoolean("showSeconds", true));
        out.put("showSince", p.getBoolean("showSince", true));
        out.put("showMilestone", p.getBoolean("showMilestone", true));
        out.put("heart", p.getString("heart", "outline"));
        out.put("protectSettings", p.getBoolean("protectSettings", false));
        out.put("notifications", p.getBoolean("notifications", false));

        call.resolve(out);
    }

    @PluginMethod
    public void saveSettings(PluginCall call) {
        SharedPreferences p = NossoTempoPrefs.get(getContext());
        SharedPreferences.Editor e = p.edit();

        Long start = call.getLong("startTime");
        String theme = call.getString("theme");
        String accent = call.getString("accent");
        Integer cardY = call.getInt("cardY");
        Integer cardScale = call.getInt("cardScale");
        Integer cardAlpha = call.getInt("cardAlpha");
        Boolean showSeconds = call.getBoolean("showSeconds");
        Boolean showSince = call.getBoolean("showSince");
        Boolean showMilestone = call.getBoolean("showMilestone");
        String heart = call.getString("heart");
        Boolean protectSettings = call.getBoolean("protectSettings");
        Boolean notifications = call.getBoolean("notifications");

        if (start != null) e.putLong("startTime", start);
        if (theme != null) e.putString("theme", theme);
        if (accent != null) e.putString("accent", accent);
        if (cardY != null) e.putInt("cardY", cardY);
        if (cardScale != null) e.putInt("cardScale", cardScale);
        if (cardAlpha != null) e.putInt("cardAlpha", cardAlpha);
        if (showSeconds != null) e.putBoolean("showSeconds", showSeconds);
        if (showSince != null) e.putBoolean("showSince", showSince);
        if (showMilestone != null) e.putBoolean("showMilestone", showMilestone);
        if (heart != null) e.putString("heart", heart);
        if (protectSettings != null) e.putBoolean("protectSettings", protectSettings);
        if (notifications != null) e.putBoolean("notifications", notifications);

        e.apply();
        MilestoneScheduler.schedule(getContext());
        call.resolve();
    }

    @PluginMethod
    public void openWallpaperPicker(PluginCall call) {
        try {
            Intent intent = new Intent(WallpaperManager.ACTION_CHANGE_LIVE_WALLPAPER);
            intent.putExtra(
                WallpaperManager.EXTRA_LIVE_WALLPAPER_COMPONENT,
                new ComponentName(getContext(), NossoTempoWallpaperService.class)
            );

            if (getActivity() != null) {
                getActivity().startActivity(intent);
            } else {
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
            }

            call.resolve();
        } catch (Exception error) {
            call.reject("Não foi possível abrir o seletor de wallpaper.", error);
        }
    }

    @PluginMethod
    public void isWallpaperActive(PluginCall call) {
        boolean active = false;
        try {
            WallpaperManager wm = WallpaperManager.getInstance(getContext());
            if (wm.getWallpaperInfo() != null) {
                ComponentName component = wm.getWallpaperInfo().getComponent();
                active = component != null &&
                    component.getClassName().equals(NossoTempoWallpaperService.class.getName());
            }
        } catch (Exception ignored) {}

        JSObject out = new JSObject();
        out.put("active", active);
        call.resolve(out);
    }

    @PluginMethod
    public void requestNotificationPermission(PluginCall call) {
        if (
            Build.VERSION.SDK_INT >= 33 &&
            getActivity() != null &&
            getActivity().checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED
        ) {
            getActivity().requestPermissions(
                new String[]{Manifest.permission.POST_NOTIFICATIONS},
                7401
            );
        }
        call.resolve();
    }

    @PluginMethod
    public void confirmIdentity(final PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P || getActivity() == null) {
            JSObject out = new JSObject();
            out.put("authenticated", true);
            call.resolve(out);
            return;
        }

        final CancellationSignal cancel = new CancellationSignal();

        BiometricPrompt.Builder builder =
            new BiometricPrompt.Builder(getActivity())
                .setTitle("Nosso Tempo")
                .setSubtitle("Confirme sua identidade para editar as configurações");

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            builder.setDeviceCredentialAllowed(true);
        } else {
            builder.setNegativeButton(
                "Cancelar",
                getActivity().getMainExecutor(),
                (dialog, which) -> {
                    call.reject("Autenticação cancelada");
                }
            );
        }

        BiometricPrompt prompt = builder.build();

        prompt.authenticate(
            cancel,
            getActivity().getMainExecutor(),
            new BiometricPrompt.AuthenticationCallback() {
                @Override
                public void onAuthenticationSucceeded(
                    BiometricPrompt.AuthenticationResult result
                ) {
                    JSObject out = new JSObject();
                    out.put("authenticated", true);
                    call.resolve(out);
                }

                @Override
                public void onAuthenticationError(
                    int errorCode,
                    CharSequence errString
                ) {
                    call.reject(
                        errString == null
                            ? "Falha na autenticação"
                            : errString.toString()
                    );
                }
            }
        );
    }
}
`);

writeJava("NossoTempoWallpaperService.java", `package ${appId};

import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.RadialGradient;
import android.graphics.RectF;
import android.graphics.Shader;
import android.os.Handler;
import android.os.Looper;
import android.service.wallpaper.WallpaperService;
import android.view.SurfaceHolder;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class NossoTempoWallpaperService extends WallpaperService {

    @Override
    public Engine onCreateEngine() {
        return new EngineImpl();
    }

    private class EngineImpl extends Engine {
        private final Handler handler = new Handler(Looper.getMainLooper());
        private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private boolean visible = false;
        private int width = 1080;
        private int height = 1920;

        private final Runnable ticker = new Runnable() {
            @Override
            public void run() {
                drawFrame();
                if (visible) {
                    long delay;
                    if (NossoTempoPrefs.showSeconds(NossoTempoWallpaperService.this)) {
                        delay = 1000L;
                    } else {
                        long now = System.currentTimeMillis();
                        delay = 60000L - (now % 60000L);
                    }
                    handler.postDelayed(this, delay);
                }
            }
        };

        @Override
        public void onVisibilityChanged(boolean v) {
            visible = v;
            handler.removeCallbacks(ticker);
            if (v) {
                drawFrame();
                handler.post(ticker);
            }
        }

        @Override
        public void onSurfaceChanged(SurfaceHolder holder, int format, int w, int h) {
            super.onSurfaceChanged(holder, format, w, h);
            width = w;
            height = h;
            drawFrame();
        }

        @Override
        public void onSurfaceDestroyed(SurfaceHolder holder) {
            visible = false;
            handler.removeCallbacks(ticker);
            super.onSurfaceDestroyed(holder);
        }

        private float sp(float value) {
            return value * getResources().getDisplayMetrics().scaledDensity;
        }

        private int accent() {
            try {
                return Color.parseColor(NossoTempoPrefs.accent(NossoTempoWallpaperService.this));
            } catch (Exception ignored) {
                return Color.rgb(221, 227, 255);
            }
        }

        private void text(float size, int alpha, Paint.Align align, boolean bold) {
            paint.setShader(null);
            paint.setStyle(Paint.Style.FILL);
            paint.setColor(Color.WHITE);
            paint.setAlpha(alpha);
            paint.setTextAlign(align);
            paint.setTextSize(sp(size));
            paint.setTypeface(
                android.graphics.Typeface.create(
                    android.graphics.Typeface.DEFAULT,
                    bold ? android.graphics.Typeface.BOLD : android.graphics.Typeface.NORMAL
                )
            );
        }

        private void drawFrame() {
            Canvas canvas = null;
            SurfaceHolder holder = getSurfaceHolder();

            try {
                canvas = holder.lockCanvas();
                if (canvas == null) return;
                drawBackground(canvas);
                drawCounter(canvas);
            } finally {
                if (canvas != null) holder.unlockCanvasAndPost(canvas);
            }
        }

        private void drawBackground(Canvas c) {
            String theme = NossoTempoPrefs.theme(NossoTempoWallpaperService.this);

            if ("oled".equals(theme)) {
                c.drawColor(Color.BLACK);
                return;
            }

            int top = Color.rgb(45, 48, 58);
            int bottom = Color.rgb(8, 9, 12);

            if ("minimal".equals(theme)) {
                top = Color.rgb(28, 29, 34);
                bottom = Color.rgb(13, 14, 17);
            } else if ("material".equals(theme)) {
                top = Color.rgb(30, 34, 40);
                bottom = Color.rgb(8, 9, 12);
            } else if ("aurora".equals(theme)) {
                top = Color.rgb(21, 24, 34);
                bottom = Color.rgb(6, 7, 10);
            }

            paint.setAlpha(255);
            paint.setShader(new LinearGradient(0, 0, 0, height, top, bottom, Shader.TileMode.CLAMP));
            c.drawRect(0, 0, width, height, paint);
            paint.setShader(null);

            if ("aurora".equals(theme) || "material".equals(theme)) {
                int a = accent();
                paint.setShader(new RadialGradient(
                    width * .25f,
                    height * .18f,
                    width * .55f,
                    new int[]{Color.argb(85, Color.red(a), Color.green(a), Color.blue(a)), Color.TRANSPARENT},
                    null,
                    Shader.TileMode.CLAMP
                ));
                c.drawRect(0, 0, width, height, paint);

                if ("aurora".equals(theme)) {
                    paint.setShader(new RadialGradient(
                        width * .82f,
                        height * .72f,
                        width * .58f,
                        new int[]{Color.argb(55, 184, 89, 159), Color.TRANSPARENT},
                        null,
                        Shader.TileMode.CLAMP
                    ));
                    c.drawRect(0, 0, width, height, paint);
                }
                paint.setShader(null);
            }
        }

        private String heart() {
            String h = NossoTempoPrefs.heart(NossoTempoWallpaperService.this);
            if ("solid".equals(h)) return "♥";
            if ("spark".equals(h)) return "✦";
            if ("none".equals(h)) return "";
            return "♡";
        }

        private void drawCounter(Canvas c) {
            long now = System.currentTimeMillis();
            long start = NossoTempoPrefs.start(NossoTempoWallpaperService.this);
            long total = Math.max(0L, (now - start) / 1000L);

            long days = total / 86400L;
            long hours = (total % 86400L) / 3600L;
            long minutes = (total % 3600L) / 60L;
            long seconds = total % 60L;

            int yPercent = NossoTempoPrefs.cardY(NossoTempoWallpaperService.this);
            float scale = NossoTempoPrefs.cardScale(NossoTempoWallpaperService.this) / 100f;
            int alphaPercent = NossoTempoPrefs.cardAlpha(NossoTempoWallpaperService.this);

            float cardW = width * .86f * scale;
            float cardH = width * .52f * scale;
            float cx = width * .5f;
            float cy = height * (yPercent / 100f);

            float left = cx - cardW / 2f;
            float top = cy - cardH / 2f;
            RectF card = new RectF(left, top, left + cardW, top + cardH);

            String theme = NossoTempoPrefs.theme(NossoTempoWallpaperService.this);
            int fillAlpha = Math.max(8, Math.min(48, alphaPercent));
            if ("oled".equals(theme)) fillAlpha = Math.min(fillAlpha, 12);
            if ("minimal".equals(theme)) fillAlpha = Math.min(fillAlpha, 16);

            paint.setShader(null);
            paint.setStyle(Paint.Style.FILL);
            paint.setColor(Color.argb((int)(255f * fillAlpha / 100f), 255, 255, 255));
            c.drawRoundRect(card, width * .045f, width * .045f, paint);

            paint.setStyle(Paint.Style.STROKE);
            paint.setStrokeWidth(Math.max(1f, width * .0014f));
            paint.setColor(Color.argb(42, 255, 255, 255));
            c.drawRoundRect(card, width * .045f, width * .045f, paint);
            paint.setStyle(Paint.Style.FILL);

            float pad = cardW * .065f;

            text(8.7f * scale, 120, Paint.Align.LEFT, true);
            c.drawText("NOSSO TEMPO", left + pad, top + cardH * .17f, paint);

            text(22f * scale, 250, Paint.Align.LEFT, true);
            c.drawText("Juntos há " + heart(), left + pad, top + cardH * .34f, paint);

            boolean showSeconds = NossoTempoPrefs.showSeconds(NossoTempoWallpaperService.this);
            int units = showSeconds ? 4 : 3;
            String[] values = showSeconds
                ? new String[]{
                    String.format(Locale.US, "%02d", days),
                    String.format(Locale.US, "%02d", hours),
                    String.format(Locale.US, "%02d", minutes),
                    String.format(Locale.US, "%02d", seconds)
                }
                : new String[]{
                    String.format(Locale.US, "%02d", days),
                    String.format(Locale.US, "%02d", hours),
                    String.format(Locale.US, "%02d", minutes)
                };

            String[] labels = showSeconds
                ? new String[]{"DIAS","HORAS","MIN","SEG"}
                : new String[]{"DIAS","HORAS","MIN"};

            float innerLeft = left + pad;
            float innerRight = left + cardW - pad;
            float unitW = (innerRight - innerLeft) / units;

            for (int i = 0; i < units; i++) {
                float x = innerLeft + unitW * (i + .5f);

                text(24f * scale, 255, Paint.Align.CENTER, true);
                c.drawText(values[i], x, top + cardH * .63f, paint);

                text(7.7f * scale, 165, Paint.Align.CENTER, true);
                c.drawText(labels[i], x, top + cardH * .76f, paint);

                if (i < units - 1) {
                    paint.setColor(Color.argb(28, 255, 255, 255));
                    paint.setStrokeWidth(1f);
                    c.drawLine(
                        innerLeft + unitW * (i + 1),
                        top + cardH * .45f,
                        innerLeft + unitW * (i + 1),
                        top + cardH * .77f,
                        paint
                    );
                }
            }

            if (NossoTempoPrefs.showSince(NossoTempoWallpaperService.this)) {
                SimpleDateFormat fmt = new SimpleDateFormat("dd/MM/yyyy • HH:mm", new Locale("pt","BR"));
                text(8f * scale, 105, Paint.Align.CENTER, false);
                c.drawText("Desde " + fmt.format(new Date(start)), cx, top + cardH * .88f, paint);
            }

            if (NossoTempoPrefs.showMilestone(NossoTempoWallpaperService.this)) {
                MilestoneUtils.Milestone m = MilestoneUtils.next(start, now);
                text(7.6f * scale, 150, Paint.Align.CENTER, false);
                paint.setColor(accent());
                paint.setAlpha(190);
                c.drawText("Próximo marco: " + m.label, cx, top + cardH * .965f, paint);
            }
        }
    }
}
`);

console.log("✅ Classes Android V2 criadas.");

// ---------------- manifest ----------------
const manifestPath = path.join(androidRoot, "app", "src", "main", "AndroidManifest.xml");
let manifest = fs.readFileSync(manifestPath, "utf8");

function ensurePermission(name) {
  if (!manifest.includes(`android.permission.${name}`)) {
    manifest = manifest.replace(
      "<application",
      `    <uses-permission android:name="android.permission.${name}" />\n\n    <application`
    );
  }
}

ensurePermission("USE_BIOMETRIC");
ensurePermission("POST_NOTIFICATIONS");
ensurePermission("RECEIVE_BOOT_COMPLETED");

manifest = manifest.replace(
  /<application\b[\s\S]*?>/m,
  (tag) => {
    if (/android:label\s*=/.test(tag)) {
      return tag.replace(/android:label\s*=\s*["'][^"']*["']/, 'android:label="Nosso Tempo"');
    }
    return tag.replace(/>$/, '\n        android:label="Nosso Tempo">');
  }
);

const activityRegex =
  /<activity\b[\s\S]*?android:name\s*=\s*["'][^"']*MainActivity["'][\s\S]*?>/m;
const activityMatch = manifest.match(activityRegex);

if (!activityMatch) {
  console.error("❌ MainActivity não encontrada no AndroidManifest.xml");
  console.log(manifest);
  process.exit(1);
}

function setAttr(tag, attr, value) {
  const escaped = attr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rx = new RegExp(`${escaped}\\s*=\\s*["'][^"']*["']`);
  if (rx.test(tag)) return tag.replace(rx, `${attr}="${value}"`);
  if (tag.endsWith("/>")) return tag.slice(0, -2) + `\n        ${attr}="${value}"\n    />`;
  return tag.slice(0, -1) + `\n        ${attr}="${value}">`;
}

let activityTag = activityMatch[0];
for (const [k,v] of [
  ["android:showWhenLocked","true"],
  ["android:turnScreenOn","true"],
  ["android:screenOrientation","portrait"],
  ["android:launchMode","singleTask"]
]) activityTag = setAttr(activityTag, k, v);

manifest = manifest.replace(activityRegex, activityTag);

if (!manifest.includes("NossoTempoWallpaperService")) {
  manifest = manifest.replace("</application>", `
        <service
            android:name=".NossoTempoWallpaperService"
            android:permission="android.permission.BIND_WALLPAPER"
            android:exported="true">
            <intent-filter>
                <action android:name="android.service.wallpaper.WallpaperService" />
            </intent-filter>
            <meta-data
                android:name="android.service.wallpaper"
                android:resource="@xml/nosso_tempo_wallpaper" />
        </service>

        <receiver
            android:name=".MilestoneReceiver"
            android:exported="false" />

        <receiver
            android:name=".BootReceiver"
            android:enabled="true"
            android:exported="false">
            <intent-filter>
                <action android:name="android.intent.action.BOOT_COMPLETED" />
            </intent-filter>
        </receiver>
    </application>`);
}

fs.writeFileSync(manifestPath, manifest, "utf8");

// ---------------- resources ----------------
const resRoot = path.join(androidRoot, "app", "src", "main", "res");
const xmlDir = path.join(resRoot, "xml");
const valuesDir = path.join(resRoot, "values");
const drawableDir = path.join(resRoot, "drawable");
const mipmapAny = path.join(resRoot, "mipmap-anydpi-v26");

for (const dir of [xmlDir, valuesDir, drawableDir, mipmapAny]) {
  fs.mkdirSync(dir, { recursive: true });
}

fs.writeFileSync(path.join(xmlDir, "nosso_tempo_wallpaper.xml"),
`<?xml version="1.0" encoding="utf-8"?>
<wallpaper
    xmlns:android="http://schemas.android.com/apk/res/android"
    android:description="@string/nosso_tempo_wallpaper_description" />
`, "utf8");

const stringsPath = path.join(valuesDir, "strings.xml");
let strings = fs.existsSync(stringsPath)
  ? fs.readFileSync(stringsPath, "utf8")
  : `<?xml version="1.0" encoding="utf-8"?><resources></resources>`;

function addString(name, value) {
  if (!strings.includes(`name="${name}"`)) {
    strings = strings.replace("</resources>", `    <string name="${name}">${value}</string>\n</resources>`);
  }
}
addString("nosso_tempo_wallpaper_description", "Nosso Tempo — contador para a tela de bloqueio");
fs.writeFileSync(stringsPath, strings, "utf8");

// Adaptive icon foreground (sem criar cor duplicada)
fs.writeFileSync(path.join(drawableDir, "ic_launcher_foreground.xml"),
`<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
    <path
        android:fillColor="@android:color/transparent"
        android:strokeColor="#FFFFFFFF"
        android:strokeWidth="5"
        android:strokeLineCap="round"
        android:strokeLineJoin="round"
        android:pathData="M54,78 C49,72 30,58 30,43 C30,32 42,27 50,34 L54,38 L58,34 C66,27 78,32 78,43 C78,58 59,72 54,78 Z"/>
    <path
        android:fillColor="#FFFFFFFF"
        android:pathData="M51,20 h6 v20 h-6 z"/>
</vector>
`, "utf8");

// Corrige somente o arquivo original de fundo do launcher, sem duplicar resource.
const launcherBg = path.join(valuesDir, "ic_launcher_background.xml");
if (fs.existsSync(launcherBg)) {
  let bg = fs.readFileSync(launcherBg, "utf8");
  bg = bg.replace(/<color name="ic_launcher_background">[^<]*<\/color>/,
                  '<color name="ic_launcher_background">#111216</color>');
  fs.writeFileSync(launcherBg, bg, "utf8");
}

console.log("✅ Manifest, Live Wallpaper, notificações, biometria e ícone configurados.");
console.log("✅ Nosso Tempo V2 pronto para compilar.");

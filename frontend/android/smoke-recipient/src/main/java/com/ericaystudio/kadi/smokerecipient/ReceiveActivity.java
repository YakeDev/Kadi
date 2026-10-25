package com.ericaystudio.kadi.smokerecipient;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.util.Log;
import android.widget.TextView;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

/** Separate emulator fixture: confirms a recipient can read only the shared PDF URI. */
public class ReceiveActivity extends Activity {
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        TextView view = new TextView(this);
        view.setTextSize(22);
        view.setPadding(32, 96, 32, 32);
        try {
            Uri uri = getIntent().getParcelableExtra(Intent.EXTRA_STREAM);
            if (uri == null || !"content".equals(uri.getScheme())) throw new Exception("Expected content URI");
            try (InputStream stream = getContentResolver().openInputStream(uri)) {
                byte[] prefix = new byte[5];
                if (stream == null || stream.read(prefix) != 5 || !"%PDF-".equals(new String(prefix, StandardCharsets.US_ASCII))) {
                    throw new Exception("Expected PDF data");
                }
            }
            view.setText("Kadi PDF Test\nPDF reçu et lisible");
            Log.i("KadiPdfTest", "PDF_READ_OK");
        } catch (Exception error) {
            view.setText("Échec de lecture du PDF");
            Log.e("KadiPdfTest", "PDF_READ_FAILED", error);
        }
        setContentView(view);
    }
}

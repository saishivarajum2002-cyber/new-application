package com.propedge.sarahpro;

import android.content.Intent;
import android.net.Uri;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

public class DirectCallModule extends ReactContextBaseJavaModule {
    DirectCallModule(ReactApplicationContext context) {
        super(context);
    }

    @Override
    public String getName() {
        return "DirectCallModule";
    }

    @ReactMethod
    public void makeCall(String phoneNumber) {
        try {
            Intent intent = new Intent(Intent.ACTION_CALL);
            intent.setData(Uri.parse("tel:" + phoneNumber));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getReactApplicationContext().startActivity(intent);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}

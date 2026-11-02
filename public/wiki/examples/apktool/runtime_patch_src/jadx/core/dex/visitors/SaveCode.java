package jadx.core.dex.visitors;

import jadx.api.ICodeInfo;
import jadx.api.JadxArgs;
import jadx.core.dex.attributes.AFlag;
import jadx.core.dex.nodes.ClassNode;
import jadx.core.dex.nodes.RootNode;
import jadx.core.utils.exceptions.JadxRuntimeException;
import jadx.core.utils.files.FileUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStreamWriter;
import java.io.PrintWriter;
import java.nio.charset.StandardCharsets;

public class SaveCode {
    private static final Logger LOG = LoggerFactory.getLogger(SaveCode.class);

    public static void save(File dir, ClassNode cls, ICodeInfo codeInfo) {
        if (cls.contains(AFlag.DONT_GENERATE)) {
            return;
        }
        if (codeInfo == null) {
            throw new JadxRuntimeException(cls.getFullName() + ": code info is null");
        }
        if (codeInfo == ICodeInfo.EMPTY) {
            return;
        }
        String code = codeInfo.getCodeStr();
        if (code.isEmpty()) {
            return;
        }

        RootNode root = cls.root();
        JadxArgs args = root.getArgs();
        if (args.isSkipFilesSave()) {
            return;
        }

        String fileName = cls.getClassInfo().getAliasFullPath() + getFileExtension(root);
        if (!args.getSecurity().isValidEntryName(fileName)) {
            return;
        }
        save(code, new File(dir, fileName));
    }

    public static void save(ICodeInfo codeInfo, File outFile) {
        save(codeInfo.getCodeStr(), outFile);
    }

    public static void save(String code, File outFile) {
        File file = FileUtils.prepareFile(outFile);
        try (PrintWriter writer = new PrintWriter(
                new OutputStreamWriter(new FileOutputStream(file), StandardCharsets.UTF_8))) {
            writer.println(code);
        } catch (Exception e) {
            LOG.error("Save file error", e);
        }
    }

    public static String getFileExtension(RootNode root) {
        JadxArgs.OutputFormatEnum format = root.getArgs().getOutputFormat();
        if (format == JadxArgs.OutputFormatEnum.JAVA) {
            return ".java";
        }
        if (format == JadxArgs.OutputFormatEnum.JSON) {
            return ".json";
        }
        throw new JadxRuntimeException("Unknown output format: " + format);
    }
}

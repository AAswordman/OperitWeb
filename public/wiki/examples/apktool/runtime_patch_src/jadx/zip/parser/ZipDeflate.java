package jadx.zip.parser;

import java.io.InputStream;
import java.nio.ByteBuffer;
import java.util.zip.DataFormatException;
import java.util.zip.Inflater;
import java.util.zip.InflaterInputStream;

final class ZipDeflate {
    private static final int BUFFER_SIZE = 4096;

    private ZipDeflate() {
    }

    static byte[] decompressEntryToBytes(ByteBuffer content, JadxZipEntry entry) throws DataFormatException {
        int compressedSize = (int) entry.getCompressedSize();
        ByteBuffer compressedSlice = content.duplicate();
        compressedSlice.position(entry.getDataStart());
        compressedSlice.limit(entry.getDataStart() + compressedSize);

        byte[] compressedData = new byte[compressedSlice.remaining()];
        compressedSlice.get(compressedData);

        byte[] output = new byte[(int) entry.getUncompressedSize()];
        Inflater inflater = new Inflater(true);
        try {
            inflater.setInput(compressedData);
            int inflated = inflater.inflate(output);
            if (inflated != output.length) {
                throw new DataFormatException(entry + " resultLen != expectedSize: " + inflated + " != " + output.length);
            }
            return output;
        } finally {
            inflater.end();
        }
    }

    static InputStream decompressEntryToStream(ByteBuffer content, JadxZipEntry entry) {
        InputStream inputStream = JadxZipParser.bufferToStream(
                content,
                entry.getDataStart(),
                (int) entry.getCompressedSize()
        );
        Inflater inflater = new Inflater(true);
        return new InflaterInputStream(inputStream, inflater, BUFFER_SIZE);
    }
}

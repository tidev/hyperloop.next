/**
 * Java Metabase Generator
 */
import java.io.File;
import java.io.OutputStreamWriter;
import java.util.Arrays;
import java.util.Enumeration;
import java.util.HashSet;
import java.util.Set;
import java.util.jar.JarFile;
import java.util.List;
import java.util.regex.Pattern;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;

import org.apache.bcel.classfile.AccessFlags;
import org.apache.bcel.classfile.ExceptionTable;
import org.apache.bcel.classfile.Field;
import org.apache.bcel.classfile.JavaClass;
import org.apache.bcel.classfile.Method;
import org.apache.bcel.generic.Type;
import org.apache.bcel.util.ClassPath;
import org.apache.bcel.util.SyntheticRepository;
import org.json.JSONArray;
import org.json.JSONObject;
import org.json.JSONWriter;

/**
 * Class that will generate a metadatabase from the Java classpath
 */
public class JavaMetabaseGenerator
{
    private static final SyntheticRepository repo = SyntheticRepository.getInstance();
    private static final Pattern isClass = Pattern.compile("\\.class$");

    /**
     * this is a regular expression of packages that we want to blacklist and not include in the output.
     * This probably isn't even needed anymore after out whitelist, but could be used to further narrow down specific classes out of the whitelisted packages we allowed.
     */
    private static final Pattern blacklist = Pattern
            .compile("^(com\\/sun|com\\/oracle|jdk\\/internal|org\\/apache\\/bcel|org\\/jcp|org\\/ietf|sun\\/|com\\/apple|quicktime\\/|apple\\/|com\\/oracle\\/jrockit|oracle\\/jrockit|sunw\\/|org\\/omg|java\\/awt|java\\/applet|junit\\/|edu\\/umd\\/cs\\/findbugs|orgpath\\/icedtea)");

    /**
     * Basically we just want:
     * android.*
     * java.*
     * javax.*
     * org.apache.http.*
     * org.json
     * org.w3c.dom*
     * org.xml.sax*
     * org.xmlpull.v1*
    **/
    private static final Pattern whitelist = Pattern
            .compile("^(android\\/|java\\/|javax\\/|org\\/apache\\/http\\/|org\\/json|org\\/w3c\\/dom|org\\/xml\\/sax|org\\/xmlpull\\/v1).+");

    private static final Pattern anonymousClass = Pattern.compile(".+\\$\\d+$");

    /**
     * determine if the class is a package-private class (with no access attributes)
     * that can only be accessed by classes within the same package
     */
    private static boolean isPackagePrivate(JavaClass cls)
    {
        return !(cls.isPublic() || cls.isPrivate() || cls.isProtected());
    }

    /**
     * enumerate over a zip/jar and load up it's classes
     */
    private static void enumerate(String filename, Enumeration<? extends ZipEntry> e, JSONWriter writer, Set<String> uniques)
            throws Exception
    {
        while (e.hasMoreElements())
        {
            String entry = e.nextElement().toString();
            if (((filename.endsWith("android.jar") && whitelist.matcher(entry).find()) || true) && !blacklist.matcher(entry).find() && isClass.matcher(entry).find())
            {
                String classname = entry.replaceAll("/", ".").replace(".class", "");
                if (uniques.contains(classname))
                {
                    continue;
                }
                try {
                    JavaClass cls = repo.loadClass(classname);
                    // skip private/anonymous classes but keep abstract and package-level classes
                    // because there may be other public classes extending them
                    if ((cls.isPublic() || cls.isProtected() || cls.isAbstract() || isPackagePrivate(cls))
                            && !anonymousClass.matcher(classname).matches()) {
                        writer.key(classname);
                        writer.object();
                        asJSON(cls, writer);
                        writer.endObject();
                    }

                    uniques.add(classname);
                } catch (Throwable t) {
                    // TODO Spit an error to System.err?
                }
            }
        }
    }

    /**
     * add access modifiers for a field or method
     */
    private static JSONArray addAttributes(AccessFlags obj)
    {
        JSONArray json = new JSONArray();

        if (obj.isFinal())
        {
            json.put("final");
        }
        if (obj.isAbstract())
        {
            json.put("abstract");
        }
        if (obj.isPrivate())
        {
            json.put("private");
        }
        if (obj.isProtected())
        {
            json.put("protected");
        }
        if (obj.isPublic())
        {
            json.put("public");
        }
        if (obj.isStatic())
        {
            json.put("static");
        }
        if (obj.isNative())
        {
            json.put("native");
        }
        if (obj.isSynchronized())
        {
            json.put("synchronized");
        }
        return json;
    }

    /**
     * this class takes no arguments and returns JSON as System.out
     */
    public static void main(String[] args) throws Exception
    {
        ClassPath cp = new ClassPath();
        String classpath = cp.getClassPath();
        String[] tokens = classpath.split(File.pathSeparator);
        // Remove the first two tokens as these are our internal BCEL and json dependencies
        List<String> tokenList = Arrays.asList(tokens).subList(2, tokens.length);

        OutputStreamWriter pw = new OutputStreamWriter(System.out, "UTF-8");
        JSONWriter writer = new JSONWriter(pw);
        writer.object();
        writer.key("classes");
        writer.object();
        Set<String> uniques = new HashSet<String>();
        for (String token : tokenList)
        {
            if (token.endsWith(".jar"))
            {
                JarFile jarFile = new JarFile(token);
                enumerate(token, jarFile.entries(), writer, uniques);
            }
            else if (token.endsWith(".zip"))
            {
                ZipFile zipFile = new ZipFile(token);
                enumerate(token, zipFile.entries(), writer, uniques);
            }
        }
        writer.endObject();
        writer.endObject();
        pw.close();
    }

    private static void asJSON(JavaClass javaClass, JSONWriter writer)
    {
        // package
        writer.key("package");
        writer.value(javaClass.getPackageName());

        // interfaces
        writer.key("interfaces");
        writer.array();
        for (String intfn : javaClass.getInterfaceNames())
        {
            writer.value(intfn);
        }
        writer.endArray();

        // superclass
        String superClassName = javaClass.getSuperclassName();
        if (javaClass.getClassName().equals(superClassName)) {
            writer.key("rootClass");
            writer.value(true);
        } else {
            writer.key("superClass");
            writer.value(superClassName);
        }

        // attributes
        writer.key("attributes");
        writer.value(addAttributes(javaClass));

        // metatype
        writer.key("metatype");
        writer.value(javaClass.isInterface() ? "interface" : "class");

        // methods
        writer.key("methods");
        JSONObject methodsJSON = new JSONObject();
        Method methods[] = javaClass.getMethods();
        generateMethodsMetadata(methods, methodsJSON);

        if (javaClass.isInterface()) {
            generateMethodsFromImplementedInterfaces(javaClass, methodsJSON);
        }

        writer.value(methodsJSON);

        // properties
        writer.key("properties");
        JSONObject propertiesJSON = new JSONObject();
        Field fields[] = javaClass.getFields();
        for (Field field : fields)
        {
            // Skip private and package-level fields entirely to save space
            // since we don't want them for now
            if (!field.isPublic() && !field.isProtected()) {
                continue;
            }

            JSONObject fieldJSON = new JSONObject();
            fieldJSON.put("name", field.getName());
            fieldJSON.put("attributes", addAttributes(field));
            fieldJSON.put("type", field.getType());
            fieldJSON.put("value", field.getConstantValue());
            fieldJSON.put("metatype", field.getConstantValue() != null ? "constant" : "field");
            fieldJSON.put("attributes", addAttributes(field));
            fieldJSON.put("instance",!field.isStatic());
            propertiesJSON.put(field.getName(), fieldJSON);
        }
        writer.value(propertiesJSON);
    }

    /**
     * Generates the metadata for all passed methods.
     *
     * @param Method methods[] Array of methods to generate metadata for.
     * @param JSONObject methodsJSON JSON object where the metadata will be stored.
     */
    private static void generateMethodsMetadata(Method methods[], JSONObject methodsJSON)
    {
        for (Method method : methods)
        {
            // Skip private and package-level methods entirely to save space
            // since we don't want them for now.
            if ((!method.isPublic() && !method.isProtected()) || method.getName().startsWith("access$")) {
                continue;
            }

            JSONObject methodJSON = new JSONObject();
            methodJSON.put("attributes", addAttributes(method));
            methodJSON.put("signature", method.getSignature());
            methodJSON.put("instance", !method.isStatic());
            methodJSON.put("name", method.getName());

            JSONArray overloads;
            if (methodsJSON.has(method.getName()))
            {
                overloads = methodsJSON.getJSONArray(method.getName());
            }
            else
            {
                overloads = new JSONArray();
            }
            overloads.put(methodJSON);
            methodsJSON.put(method.getName(), overloads);
            JSONArray argumentJSON = new JSONArray();
            for (Type type : method.getArgumentTypes())
            {
                JSONObject obj = new JSONObject();
                obj.put("type", type);
                argumentJSON.put(obj);
            }
            methodJSON.put("args", argumentJSON);
            methodJSON.put("returnType", method.getReturnType());
            JSONArray exceptionsJSON = new JSONArray();
            ExceptionTable exceptions = method.getExceptionTable();
            if (exceptions != null)
            {
                for (String exname : exceptions.getExceptionNames())
                {
                    exceptionsJSON.put(exname);
                }
            }
            methodJSON.put("exceptions", exceptionsJSON);
        }
    }

    /**
     * Generates method metadata for all methods from interfaces a class or
     * interface implements.
     *
     * @param JavaClass javaClass Java class or interface to check for implemented interfaces
     * @param JSONObject methodssJSON JSON object to store method metadata
     */
    private static void generateMethodsFromImplementedInterfaces(JavaClass javaClass, JSONObject methodssJSON)
    {
        String[] implementedInterfacesNames = javaClass.getInterfaceNames();
        for (String interfaceName : implementedInterfacesNames) {
            JavaClass interfaceClass = repo.findClass(interfaceName);
            if (interfaceClass == null) {
                continue;
            }

            Method methods[] = interfaceClass.getMethods();
            generateMethodsFromImplementedInterfaces(interfaceClass, methodssJSON);
            generateMethodsMetadata(methods, methodssJSON);
        }
    }
}

#include "gfx/mesh.hpp"
#include "core/log.hpp"
#include <cstring>

namespace q {

bool GpuMesh::load(Blob b) {
    Reader r(b);
    char magic[4];
    r.bytes(magic, 4);
    if (memcmp(magic, "QMSH", 4)) { QERR("bad mesh"); return false; }
    r.get<uint32_t>();
    uint32_t flags = r.get<uint32_t>();
    vertex_count = int(r.get<uint32_t>());
    index_count = int(r.get<uint32_t>());
    r.bytes(&bmin, 12);
    r.bytes(&bmax, 12);
    skinned = flags & 1;
    int stride = skinned ? 40 : 32;
    const uint8_t* verts = r.skip(size_t(vertex_count) * stride);
    const uint8_t* idx = r.skip(size_t(index_count) * 4);
    if (!r.ok(0) && r.p > r.end) { QERR("mesh truncated"); return false; }

    glGenVertexArrays(1, &vao);
    glBindVertexArray(vao);
    glGenBuffers(1, &vbo);
    glBindBuffer(GL_ARRAY_BUFFER, vbo);
    glBufferData(GL_ARRAY_BUFFER, GLsizeiptr(vertex_count) * stride, verts, GL_STATIC_DRAW);
    glGenBuffers(1, &ibo);
    glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, ibo);
    glBufferData(GL_ELEMENT_ARRAY_BUFFER, GLsizeiptr(index_count) * 4, idx, GL_STATIC_DRAW);
    glEnableVertexAttribArray(0);
    glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, stride, (void*)0);
    glEnableVertexAttribArray(1);
    glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, stride, (void*)12);
    glEnableVertexAttribArray(2);
    glVertexAttribPointer(2, 4, GL_UNSIGNED_BYTE, GL_TRUE, stride, (void*)24);
    glEnableVertexAttribArray(3);
    glVertexAttribPointer(3, 4, GL_UNSIGNED_BYTE, GL_TRUE, stride, (void*)28);
    if (skinned) {
        glEnableVertexAttribArray(4);
        glVertexAttribIPointer(4, 4, GL_UNSIGNED_BYTE, stride, (void*)32);
        glEnableVertexAttribArray(5);
        glVertexAttribPointer(5, 4, GL_UNSIGNED_BYTE, GL_TRUE, stride, (void*)36);
    } else {
        glDisableVertexAttribArray(4);
        glVertexAttribI4ui(4, 0, 0, 0, 0);
        glDisableVertexAttribArray(5);
        glVertexAttrib4f(5, 1, 0, 0, 0);
    }
    glBindVertexArray(0);
    return true;
}

void GpuMesh::destroy() {
    if (vao) glDeleteVertexArrays(1, &vao);
    if (vbo) glDeleteBuffers(1, &vbo);
    if (ibo) glDeleteBuffers(1, &ibo);
    vao = vbo = ibo = 0;
}

}  // namespace q

namespace q {

bool MeshBuilder::upload(GpuMesh& out) const {
    std::vector<uint8_t> blob;
    auto put = [&](const void* d, size_t n) { const uint8_t* b = (const uint8_t*)d; blob.insert(blob.end(), b, b + n); };
    put("QMSH", 4);
    uint32_t hdr[4] = {1, 0, uint32_t(v.size()), uint32_t(idx.size())};
    put(hdr, 16);
    vec3 lo{1e9f, 1e9f, 1e9f}, hi{-1e9f, -1e9f, -1e9f};
    for (auto& x : v) { lo = minv(lo, x.p); hi = maxv(hi, x.p); }
    put(&lo, 12); put(&hi, 12);
    for (auto& x : v) { put(&x.p, 12); put(&x.n, 12); put(x.c, 4); put(x.m, 4); }
    put(idx.data(), idx.size() * 4);
    return out.load(Blob{blob.data(), blob.size()});
}

}  // namespace q
